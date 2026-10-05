# Réponse — Lot 1 implémenté, corrections sur le reste

Suite à `DEMANDE_BACKEND_APP_CLIENT_COMPLETE.md`. Le **Lot 1** (A2, D2, E1, C1, C3, E2) est implémenté, testé syntaxiquement et poussé en production. Avant de détailler chaque contrat, trois points de votre audit étaient déjà couverts par du code livré **le même jour, un peu avant votre analyse** — à vérifier côté app avant de recoder un contournement inutile.

---

## Corrections sur des points déjà résolus

| Votre constat | Réalité |
|---|---|
| **A2** : `simulate-interville` exige un token | Déjà public (`routes/api.php`), hors du groupe `auth:sanctum`. Rien à faire côté backend sur ce point précis — seul `formats-colis` était réellement protégé (corrigé, voir plus bas). |
| **B2** : rien ne permet de connaître le prix d'enlèvement avant validation | `GET /expedition/client/grille-tarifs-enlevement?commune_id=` existe déjà (livré juste avant votre audit) — expose la grille brute par tranche km/véhicule. Voir `docs/REPONSE_AUDIT_CAHIER_DES_CHARGES_CLIENT.md` section 7 pour le contrat complet. Ne couvre pas un calcul serveur de distance (OSRM/Google) : si c'est spécifiquement ça qu'il vous faut, dites-le, ce n'est pas fait. |
| **C1** : aucun événement `Expedition/status_changed` | L'événement existait déjà (`ExpeditionObserver`), mais diffusé uniquement vers les canaux agence/backoffice, jamais vers le client — **c'est corrigé dans ce lot** (voir section C1 ci-dessous). |
| **C3** : `mode` et le montant absents de `GET .../missions` | Ils étaient déjà dans le payload Eloquent brut (`mode`, `montant_fixe`, `montant_final`). Le vrai manque était le livreur assigné — corrigé dans ce lot. |

---

## Lot 1 — ce qui est livré

### A2 — Estimation Interville sans compte

`GET /expedition/client/formats-colis` est désormais public. Comportement :
- **Connecté** : inchangé, déduit le pays depuis `User::code_pays`.
- **Invité** : passer `?code_pays=CI` en query param.

```
GET /api/expedition/client/formats-colis?code_pays=CI
```

`simulate-interville` était déjà public, aucun changement necessaire là-dessus.

### D2 — Compte de réception pour payer l'abonnement

```
GET /api/abonnement/moyens-paiement
```

Accessible même bloqué (hors middleware `abonnement.a.jour`), pour vendeur et livreur :

```json
{
  "success": true,
  "moyens": [
    { "methode": "mobile_money", "libelle": "Orange Money TourShop", "numero_destinataire": "0700000000", "instructions": "Indiquez votre téléphone en motif" }
  ]
}
```

`moyens: []` si le backoffice n'a pas encore configuré de moyen de paiement (nouveau champ, à renseigner côté backoffice via `PUT /backoffice/abonnement/settings` — mêmes champs `moyen_paiement_libelle`/`moyen_paiement_numero`/`moyen_paiement_instructions` ajoutés à la config existante). Gérez ce cas vide dans l'UI (ex. « Contactez votre agence pour connaître le moyen de paiement »).

### E1 — Recherche d'un livreur pour l'affectation directe

```
GET /api/marketplace/vendeur/livreurs/recherche?telephone=0705060708
```

```json
{ "success": true, "livreur": { "id": "uuid", "nom": "Yao", "prenoms": "Paul", "type_vehicule": "moto", "ville": "Abidjan", "disponible": true } }
```

`404` si aucun livreur validé KYC du même pays ne correspond à ce numéro exact (pas de distinction entre « numéro inexistant » et « compte non-livreur » — volontaire, pas de fuite sur l'existence d'un compte). Le `livreur.id` renvoyé est directement utilisable comme `livreur_id` sur `POST .../livraison/direct`.

Non livré : `GET /livreurs/recents` (livreurs ayant déjà livré pour ce vendeur) — c'était une option, pas demandé en priorité P0. Dites si vous en avez besoin.

### C1 — Suivi en temps réel sur le canal client

Canal `client.{clientId}`, événement `model.updated` comme partout ailleurs :

| `model` | `action` | Quand | `data` |
|---|---|---|---|
| `Expedition` | `status_changed` | Tout changement de `statut_expedition` | `{ id, reference, statut_expedition, date_prevue_enlevement, date_enlevement_client, date_livraison_agence, date_deplacement_entrepot, date_expedition_depart, date_expedition_arrivee, date_reception_agence, date_reception_client }` |
| `Expedition` | `payment_confirmed` | Changement de `statut_paiement` | `{ id, reference, statut_paiement }` |
| `Mission` | `etape` | Une des 5 étapes : `enlevement_demarre`, `colis_recupere`, `colis_depose_agence_livreur`, `livraison_demarree`, `colis_livre` | `{ expedition_id, type: "enlevement"\|"livraison", etape }` |

Seulement pour les expéditions créées par un client authentifié (`is_demande_client`) — une expédition créée au comptoir par l'agence n'a pas de compte client propriétaire à notifier.

Non livré dans ce lot : `Expedition/accepted`/`refused` comme actions séparées, `Facture/created`. `status_changed` porte déjà la valeur `accepted`/`refused` dans `statut_expedition` — si vous avez besoin d'actions dédiées plutôt que de filtrer sur la valeur du statut, dites-le.

### C3 — Missions enrichies, annulation

`GET /expedition/client/{id}/missions` renvoie désormais, par mission :

```json
{
  "id": "uuid", "type": "livraison", "mode": "express", "statut": "assignee",
  "montant": 1500,
  "livreur": { "nom": "Yao", "prenoms": "Paul", "telephone": "0705060708", "type_vehicule": "moto" },
  "preuve": null
}
```

`montant` = `montant_final` si fixé, sinon `montant_fixe` (tarif groupage résolu à l'avance). `livreur` est `null` tant que la mission n'est pas `assignee` — **le téléphone n'est jamais exposé avant assignation réelle**, y compris en express où une offre est déjà `proposee`.

Nouvelle route :
```
POST /expedition/client/missions/{missionId}/annuler
```
Possible uniquement si la mission est encore `en_attente` (pas encore assignée). Refuse toutes les offres actives et diffuse `Mission/cloturee` aux livreurs offrants (pas de nouvelle action à écouter côté client, c'est pour les livreurs).

### E2 — Annulation et expiration des commandes marketplace

```
POST /marketplace/acheteur/commandes/{id}/annuler   { "motif"? }
POST /marketplace/vendeur/ventes/{id}/annuler        { "motif"? }
```

Possible tant que la commande n'est pas `payee`/`livraison_en_attente`/`livraison_assignee`/`livree`. Diffuse `CommandeMarketplace/annulee` vers acheteur et vendeur.

⚠️ **Point important sur votre constat initial** : les annonces ne sont **pas verrouillées** à la validation du panier — elles restent `publiee` jusqu'à ce que le vendeur confirme avoir reçu le paiement (`confirmerReceptionPaiement`, qui les passe `vendue`). Donc annuler une commande non payée ne « libère » rien côté annonce : l'article était de toute façon achetable par quelqu'un d'autre entre-temps. Si le comportement attendu est un vrai verrou (réserver l'article dès la validation du panier, empêcher un double achat simultané), c'est un changement de design à discuter séparément — pas inclus dans ce lot.

Expiration automatique : commande planifiée (`marketplace:expire-commandes-non-payees`, exécutée toutes les heures) annule après 48h sans déclaration de paiement, avec le motif « Expirée : aucun paiement déclaré dans le délai. ».

---

## Pas encore traité (hors Lot 1)

Tout le reste du document (A1, A3, B1, B3, B4, C2, C4, C5, C6, D1, D3, E3 à E8, F1 à F3, G1, G2, H1, I1) n'a pas été touché dans cette session — c'est le contenu des lots 2 à 5 que vous avez proposés, plus E8/D1 qui restent des décisions produit. On attaque dans cet ordre si vous validez le découpage, sinon dites la priorité réelle.

Un point à signaler en particulier : **C4** (espace destinataire sans compte par lien à jeton) correspond exactement à un trou qu'on avait déjà identifié de notre côté avant de lire votre document — votre proposition de contrat (jeton 32 octets, routes `/suivi/{token}`) est cohérente avec ce qu'on envisageait, probable candidat pour le prochain lot.
