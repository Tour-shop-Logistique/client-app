# Parcours client : frais annexes et preuve de paiement

Document pour le développeur de l'application cliente.

## Principe

Après le contrôle de l'expédition, le backoffice peut fixer des **frais annexes** (douanes, assurance, etc.). Le client les paie **directement à l'agence de départ, hors de l'application** (mobile money, virement, espèces). Il dépose ensuite une **preuve de paiement** dans l'application. L'agence la vérifie, puis la confirme ou la rejette.

L'application ne traite aucun paiement : elle affiche les coordonnées de paiement de l'agence et collecte la preuve.

## Workflow

```
Backoffice fixe les frais annexes
        │
        ├─ SMS + email + push + WebSocket vers le client
        ▼
1. Le client voit les frais à régler (WebSocket ou push)
2. L'app charge l'expédition et les moyens de paiement de l'agence
3. Le client paie l'agence, hors application
4. Le client dépose sa preuve (photo + montant + méthode)
        │
        ├─ WebSocket vers l'agence
        ▼
5. L'agence confirme ou rejette la preuve
        │
        ├─ WebSocket + push vers le client
        ▼
   Confirmée → frais passés à « payé », l'expédition peut partir
   Rejetée   → le client lit le motif et redépose une preuve
```

## 1. Être prévenu des frais annexes

Le client est le propriétaire de l'expédition (`expedition.user_id`). Il reçoit les frais sur trois canaux :

- **SMS et email**, envoyés à l'expéditeur.
- **Push** (compte client), uniquement pour les demandes créées depuis l'application.
- **WebSocket**, sur le canal `client.{id}` (`id` = identifiant de l'utilisateur connecté).

Événement WebSocket :

| Champ | Valeur |
|---|---|
| `model` | `Expedition` |
| `action` | `frais_annexes_updated` |
| `items[0].id` | identifiant de l'expédition |
| `items[0].reference` | référence de l'expédition |
| `items[0].agence_id` | agence à payer |
| `items[0].frais_annexes` | montant à régler |
| `items[0].statut_paiement_frais` | `en_attente` (nouveau montant) ou `paye` |
| `changes.frais_annexes` | nouveau montant |

Si `frais_annexes` vaut 0, il n'y a plus rien à payer. Un nouveau montant remet `statut_paiement_frais` à `en_attente` et invalide la décision précédente de l'agence.

Le WebSocket n'est qu'un déclencheur. Rechargez toujours l'expédition pour avoir l'état complet (voir ci-dessous), et ne vous fiez pas à lui seul : un client hors ligne ne le reçoit pas.

## 2. Charger l'expédition

`GET /api/expedition/client/show/{id}`

Lisez dans la réponse :
- `frais_annexes` : montant à payer.
- `statut_paiement_frais` : `en_attente`, `paye` ou `refuse`.
- `agence` et `agence_id` : l'agence de départ, qui encaisse les frais.

Afficher le bloc « Frais annexes à régler » quand `frais_annexes > 0` et `statut_paiement_frais = en_attente`.

## 3. Afficher les moyens de paiement de l'agence

`GET /api/expedition/client/agence/{agenceId}/moyens-paiement`

Réponse :

```json
{
  "success": true,
  "moyens_paiement": [
    { "id": "uuid", "methode": "mobile_money", "numero_destinataire": "+2250700000000", "libelle": "Wave" }
  ]
}
```

| Champ | Contenu |
|---|---|
| `methode` | `mobile_money`, `bank_transfer`, `cash`, `card` ou `other` |
| `numero_destinataire` | numéro de téléphone, IBAN ou référence, selon la méthode |
| `libelle` | texte libre saisi par l'agence : opérateur (Wave, Orange Money, M-Pesa…), banque et titulaire, ou précision |

À savoir :
- Seuls les moyens **actifs** sont renvoyés. L'agence les active par défaut à la création.
- L'application sert plusieurs pays : **n'affichez pas de liste d'opérateurs figée**, affichez `libelle` tel quel.
- Prévoyez un bouton « Copier » sur `numero_destinataire`.
- Liste vide : afficher « L'agence n'a pas encore renseigné de moyen de paiement. Contactez-la. »
- `card` n'est plus proposé aux agences, mais d'anciens moyens peuvent exister : traitez-le comme `other`.

## 4. Déposer la preuve de paiement

`POST /api/expedition/client/preuves-paiement`, en `multipart/form-data`.

| Champ | Obligatoire | Règle |
|---|---|---|
| `expedition_id` | oui | uuid de l'expédition |
| `objet_paiement` | oui | **`frais_annexes`** pour ce parcours |
| `montant` | oui | nombre ≥ 0 |
| `methode_paiement` | oui | `cash`, `mobile_money`, `bank_transfer`, `card` ou `other` |
| `reference_transaction` | non | 100 caractères max (ID de transaction de l'opérateur) |
| `photo` | oui | image jpeg, png, jpg ou webp, 5 Mo max |

Réponse `201` :

```json
{ "success": true, "message": "Preuve de paiement soumise.", "preuve": { "id": "uuid", "statut": "en_attente", "...": "..." } }
```

Erreurs :
- `422` : champ invalide (le message est en français, affichez-le).
- `403` : l'expédition n'appartient pas au client.
- `500` : message générique, proposez de réessayer.

Conseils d'interface :
- Pré-remplir `montant` avec `frais_annexes`.
- Compresser la photo avant l'envoi (limite de 5 Mo).
- Après un dépôt réussi, afficher « Preuve envoyée, en attente de confirmation de l'agence » et masquer le bouton de dépôt tant qu'une preuve est `en_attente`.

## 5. Suivre l'état des preuves

`GET /api/expedition/client/{id}/preuves-paiement`

Réponse : `{ "success": true, "preuves": [ ... ] }`, de la plus récente à la plus ancienne.

Champs utiles d'une preuve :

| Champ | Contenu |
|---|---|
| `id` | identifiant |
| `objet_paiement` | `frais_annexes`, `montant_expedition`, `frais_enlevement`, `frais_livraison`… |
| `montant`, `methode_paiement`, `reference_transaction` | ce que le client a saisi |
| `photo_path` | chemin de la photo |
| `statut` | `en_attente`, `confirmee` ou `rejetee` |
| `motif_rejet` | renseigné quand `statut = rejetee` |
| `confirme_le` | date de la décision |

Cette liste sert à reconstruire l'écran au chargement, et à retrouver l'état si une notification a été manquée.

## 6. Décision de l'agence

Le client reçoit la décision sur deux canaux :

- **WebSocket**, canal `client.{id}`, `model = PreuvePaiement`, `action = confirmee` ou `rejetee`.
- **Push**, titre « Paiement confirmé » ou « Preuve de paiement rejetée ».

Champs de `items[0]` :

| Champ | Contenu |
|---|---|
| `id` | identifiant de la preuve |
| `expedition_id`, `reference` | expédition concernée |
| `objet_paiement` | objet payé |
| `statut` | `confirmee` ou `rejetee` |
| `motif_rejet` | motif, si rejet |

Comportement attendu de l'application :

- **`confirmee`** : afficher « Paiement confirmé ». Recharger l'expédition : `statut_paiement_frais` est passé à `paye`. Retirer le bloc « Frais annexes à régler ».
- **`rejetee`** : afficher le `motif_rejet` et un bouton « Déposer une nouvelle preuve ». Les frais restent `en_attente`. Le client peut redéposer autant de fois que nécessaire.

## Autres objets de paiement

La même route de dépôt sert aux autres paiements (`montant_expedition`, `frais_enlevement`, `frais_livraison`, `tout_compris`). Seule la confirmation d'une preuve **`frais_annexes`** met à jour automatiquement le statut de paiement de l'expédition. Pour les autres objets, la preuve est enregistrée et confirmée, mais aucun statut d'expédition n'est modifié automatiquement à ce stade.

## Récapitulatif des routes

Toutes sont authentifiées (jeton Sanctum, compte `client`).

| Étape | Méthode | Route |
|---|---|---|
| Charger l'expédition | GET | `/api/expedition/client/show/{id}` |
| Moyens de paiement de l'agence | GET | `/api/expedition/client/agence/{agenceId}/moyens-paiement` |
| Déposer une preuve | POST | `/api/expedition/client/preuves-paiement` |
| Lister les preuves | GET | `/api/expedition/client/{id}/preuves-paiement` |

## Événements WebSocket à écouter (canal `client.{id}`)

| `model` | `action` | Quand | Réaction de l'application |
|---|---|---|---|
| `Expedition` | `frais_annexes_updated` | frais fixés ou modifiés | recharger l'expédition, afficher le bloc de paiement |
| `PreuvePaiement` | `confirmee` | l'agence confirme | recharger l'expédition, afficher la confirmation |
| `PreuvePaiement` | `rejetee` | l'agence rejette | afficher le motif, proposer de redéposer |

## Points d'attention

- Les notifications sont un déclencheur, pas la source de vérité : au démarrage et à chaque ouverture de l'écran d'une expédition, relisez `show` et la liste des preuves.
- Ne calculez jamais le statut de paiement côté application : il vient de `statut_paiement_frais`.
- L'agence confirme sur la base de la photo et de la référence : une photo lisible et une `reference_transaction` accélèrent la confirmation.
- Un client sans moyen de paiement affiché ne peut pas payer : prévoyez un lien pour contacter l'agence (téléphone ou WhatsApp de l'agence).
