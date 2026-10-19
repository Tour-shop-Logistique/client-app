# Changements à implémenter — Apps Client et Livreur

Document destiné à l'équipe frontend des applications **client** et **livreur**.
Il décrit uniquement ce qui change par rapport à l'existant. Les endpoints non
mentionnés ici gardent leur comportement actuel.

Date : 18 octobre 2026
Backend : déployé, migrations appliquées.

---

## Sommaire

1. [Devise dynamique — remplacer XOF codé en dur](#1-devise-dynamique)
2. [Mode express — plus d'offres, prix imposé](#2-mode-express--plus-doffres-prix-imposé)
3. [Paiement à distance avec preuves](#3-paiement-à-distance-avec-preuves)
4. [Nouveau parcours destinataire](#4-nouveau-parcours-destinataire)
5. [Récapitulatif des endpoints](#5-récapitulatif-des-endpoints)

---

## 1. Devise dynamique

### Ce qui change

La devise était codée en dur à `XOF` dans les deux apps. Elle doit désormais
venir du backend : chaque backoffice (un par pays) a sa propre devise, et un
même utilisateur peut donc être en `XOF`, `XAF`, `EUR`, etc.

### Comment la récupérer

Le profil utilisateur expose maintenant un champ `devise` (code ISO 4217) :

```http
GET /api/profile/
Authorization: Bearer {token}
```

```json
{
  "success": true,
  "user": {
    "id": "9b1c...",
    "nom": "Koné",
    "type": "client",
    "code_pays": "CI",
    "devise": "XOF"
  }
}
```

Le champ est présent sur **toutes** les réponses qui contiennent un objet user,
pas seulement le profil.

### À faire côté app

- Lire `user.devise` au login et le stocker dans le state global.
- Remplacer toute constante `'XOF'` / `'FCFA'` par cette valeur.
- Prévoir un formatage par code devise (le symbole affiché n'est pas toujours
  « FCFA »).

### Cas particulier : devise d'une expédition

Une expédition conserve la devise de son **pays de départ**, qui peut différer
de celle de l'utilisateur qui la consulte. Chaque expédition expose pour cela :

```json
{ "devise_origine": "EUR" }
```

Pour afficher un montant d'expédition, utiliser `expedition.devise_origine`,
**pas** `user.devise`. Si vous voulez afficher une conversion dans la devise de
l'utilisateur, l'endpoint existant reste disponible :

```http
GET /api/exchange-rate?from=EUR&to=XOF
```

---

## 2. Mode express — plus d'offres, prix imposé

### Ce qui change (changement majeur)

**Avant :** en mode express, les livreurs proposaient chacun leur prix, le
client comparait les offres et en acceptait une.

**Maintenant :** le prix est calculé par le backend et imposé. Les livreurs
voient la course avec son prix et la prennent — **premier arrivé, premier
servi**. Il n'y a plus de négociation.

### Calcul du prix

Le backoffice définit, par commune et par type de véhicule, des tranches de
kilométrage avec :
- un **montant standard** (mode groupage) ;
- un **taux express** (multiplicateur).

```
prix express = montant standard × taux express
```

L'express est donc toujours plus cher que le standard.

### Impact app CLIENT

L'endpoint de la grille tarifaire renvoie désormais les deux prix :

```http
GET /api/expedition/client/grille-tarifs-enlevement?commune_id={uuid}
```

```json
{
  "success": true,
  "data": [
    {
      "type_vehicule": "moto",
      "km_min": 0,
      "km_max": 5,
      "montant_standard": 1000,
      "taux_express": 1.5,
      "montant_express": 1500
    },
    {
      "type_vehicule": "moto",
      "km_min": 5,
      "km_max": null,
      "montant_standard": 2000,
      "taux_express": 1.5,
      "montant_express": 3000
    }
  ]
}
```

> **Attention — changement cassant :** le champ `montant` a été renommé en
> `montant_standard`. Les clés `taux_express` et `montant_express` sont
> nouvelles.

`km_max: null` = dernière tranche, illimitée vers le haut.
`taux_express: null` = l'express n'est pas disponible sur cette tranche.

**À faire :**
- Afficher les deux options (standard / express) avec leur prix avant que le
  client choisisse, pour qu'il sache ce qu'il paiera.
- Retirer tout l'écran de comparaison d'offres livreurs pour l'express.
- Les routes d'offres restent en place mais sont **dépréciées** :
  `GET /api/expedition/client/missions/{missionId}/offres` et
  `POST .../offres/{offreId}/accepter`.

La demande d'enlèvement/livraison ne change pas de forme :

```http
POST /api/expedition/client/{id}/demander-enlevement
POST /api/expedition/client/{id}/demander-livraison
```

```json
{
  "mode": "express",
  "type_vehicule": "moto",
  "distance_km": 7.4,
  "latitude": 5.3599,
  "longitude": -4.0083,
  "instructions": "Portail bleu"
}
```

En mode `express`, la mission est créée directement avec son `montant_fixe`
calculé, puis diffusée aux livreurs. Aucune offre à attendre.

> Si aucun taux express n'est configuré pour la tranche, la réponse est un
> `422` avec un message explicite. Prévoir l'affichage de l'erreur et proposer
> le mode standard en repli.

### Impact app LIVREUR

Les missions disponibles portent maintenant leur prix dans `montant_fixe` :

```http
GET /api/expedition/livreur/missions-disponibles
```

```json
{
  "success": true,
  "missions": [
    {
      "id": "9b2f...",
      "type": "enlevement",
      "mode": "express",
      "statut": "en_attente",
      "montant_fixe": 1500,
      "montant_final": 1500,
      "distance_km": 3.2,
      "expedition": { "reference": "TS-ABJ-00123" }
    }
  ]
}
```

**Nouvel endpoint — accepter une course :**

```http
POST /api/expedition/livreur/missions/{missionId}/accepter
Authorization: Bearer {token}
```

Réponse succès :

```json
{
  "success": true,
  "message": "Mission acceptée.",
  "mission": { "id": "9b2f...", "statut": "assignee", "montant_final": 1500 }
}
```

Erreurs possibles (`422`) :

| Message | Signification |
|---|---|
| `Cette mission a déjà été prise par un autre livreur.` | Un autre livreur a été plus rapide |
| `Vous devez être disponible pour accepter une mission.` | `disponible` est à `false` |
| `Vous avez déjà une mission en cours.` | Une mission est déjà assignée |

**À faire :**
- Afficher le prix sur chaque course de la liste.
- Remplacer le formulaire « proposer un prix » par un bouton « Accepter ».
- **Gérer la concurrence** : l'erreur « déjà prise » est un cas normal, pas un
  bug. Retirer la course de la liste et afficher un message non bloquant.
- Les anciennes routes `POST .../proposer` et `DELETE .../offre` restent en
  place mais sont **dépréciées**.

---

## 3. Paiement à distance avec preuves

### Principe

Aucun paiement ne transite par la plateforme (pas de passerelle intégrée).
Le client paie **hors application** (mobile money, virement, espèces) sur un
numéro fourni par l'agence, puis **dépose une preuve** dans l'app. L'agence
confirme ou rejette cette preuve.

### Étape 1 — Afficher les moyens de paiement de l'agence

```http
GET /api/expedition/client/agence/{agenceId}/moyens-paiement
Authorization: Bearer {token}
```

```json
{
  "success": true,
  "moyens_paiement": [
    {
      "id": "9b3a...",
      "methode": "mobile_money",
      "numero_destinataire": "0700000000",
      "libelle": "Orange Money — Compte principal"
    }
  ]
}
```

Seuls les moyens actifs sont renvoyés. `methode` ∈ `mobile_money`,
`bank_transfer`, `cash`, `card`, `other`.

L'`agenceId` est celui de l'agence de départ de l'expédition
(`expedition.agence_id`).

### Étape 2 — Déposer une preuve de paiement

```http
POST /api/expedition/client/preuves-paiement
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

| Champ | Type | Requis | Détail |
|---|---|---|---|
| `expedition_id` | uuid | oui | L'expédition concernée |
| `objet_paiement` | string | oui | Voir table ci-dessous |
| `montant` | number | oui | Montant versé |
| `methode_paiement` | string | oui | `mobile_money`, `bank_transfer`, `cash`, `card`, `other` |
| `reference_transaction` | string | non | N° de transaction mobile money |
| `photo` | file | oui | Capture ou reçu (jpeg/png/jpg/webp, 5 Mo max) |

Valeurs de `objet_paiement` :

| Valeur | Signification |
|---|---|
| `montant_expedition` | Prix de base de l'expédition |
| `frais_annexes` | Douane, assurance… (ajoutés après contrôle) |
| `frais_enlevement` | Enlèvement à domicile |
| `frais_livraison` | Livraison à domicile |
| `tout_compris` | Règlement global |

Réponse (`201`) :

```json
{
  "success": true,
  "message": "Preuve de paiement soumise.",
  "preuve": { "id": "9b4c...", "statut": "en_attente", "montant": 25000 }
}
```

Seuls l'expéditeur (`user_id`) et le destinataire (`destinataire_user_id`) de
l'expédition peuvent déposer une preuve — sinon `403`.

### Étape 3 — Suivre le statut des preuves

```http
GET /api/expedition/client/{id}/preuves-paiement
```

```json
{
  "success": true,
  "preuves": [
    {
      "id": "9b4c...",
      "objet_paiement": "montant_expedition",
      "montant": 25000,
      "methode_paiement": "mobile_money",
      "reference_transaction": "PP240918.1423.A1",
      "photo_path": "https://.../preuve.jpg",
      "statut": "rejetee",
      "motif_rejet": "Montant incomplet",
      "confirme_le": "2026-10-18T14:30:00.000000Z"
    }
  ]
}
```

Statuts : `en_attente` → `confirmee` ou `rejetee`.
En cas de rejet, `motif_rejet` est renseigné et doit être affiché au client
pour qu'il puisse corriger et redéposer.

### Ce que le client doit voir avant de payer

Le client doit connaître le total à régler. Chaque expédition expose
`accounting_details.total_client_due`, qui additionne : montant de base,
prestation, emballage, frais d'enlèvement, frais de livraison, frais de retard
et frais annexes.

```json
{
  "accounting_details": { "total_client_due": 28500 },
  "statut_paiement": "en_attente",
  "montant_paye": 0
}
```

### Qui paie le livreur

| Cas | Payeur |
|---|---|
| Enlèvement à domicile | L'agence de départ, après dépôt du colis |
| Livraison à domicile choisie par l'expéditeur | L'agence |
| Livraison à domicile demandée par le destinataire | **Le destinataire** (voir §4) |

Le livreur n'a rien à faire dans l'app pour être payé : son solde est crédité
automatiquement à la clôture de la mission (`GET /api/livreur/solde`, inchangé).
Le versement réel et sa preuve sont gérés par l'agence.

---

## 4. Nouveau parcours destinataire

### Principe

Jusqu'ici le destinataire était un simple contact (nom + téléphone stockés en
JSON). Il peut maintenant, **s'il a un compte client**, suivre ses colis et
demander une livraison à domicile alors que l'expéditeur avait choisi la
récupération en agence. Dans ce cas, **c'est lui qui paie le livreur**.

Toutes les routes ci-dessous sont authentifiées et attendent un utilisateur de
type `client`.

### Lister les colis qui me sont destinés

```http
GET /api/destinataire/mes-expeditions
Authorization: Bearer {token}
```

Le rapprochement se fait sur `destinataire_user_id` **ou** sur le téléphone du
compte comparé au téléphone renseigné dans le champ destinataire. Réponse
paginée (20 par page), avec agences et colis.

### Rechercher une expédition par code

```http
POST /api/destinataire/rechercher
```

```json
{ "code": "TS-ABJ-00123" }
```

Réponse :

```json
{
  "success": true,
  "expedition": {
    "id": "9b1f...",
    "reference": "TS-ABJ-00123",
    "statut_expedition": "recu_agence_destination",
    "pays_depart": "France",
    "pays_destination": "Côte d'Ivoire",
    "agence_arrivee": { "nom_agence": "TS Cocody", "ville": "Abidjan" },
    "is_livraison_domicile": false
  }
}
```

La référence est celle que le destinataire reçoit par e-mail/SMS. Réponse
volontairement réduite : pas de montants ni de données de l'expéditeur.

### Demander une livraison à domicile

Disponible quand le colis est arrivé et qu'aucune livraison à domicile n'est
déjà prévue (`is_livraison_domicile: false`).

```http
POST /api/destinataire/{id}/demander-livraison
```

```json
{
  "mode": "express",
  "type_vehicule": "moto",
  "distance_km": 4.2,
  "latitude": 5.3599,
  "longitude": -4.0083,
  "instructions": "Immeuble en face de la pharmacie"
}
```

| Champ | Requis | Détail |
|---|---|---|
| `mode` | oui | `groupage` ou `express` |
| `type_vehicule` | non | `moto` ou `voiture` |
| `distance_km` | non | Distance agence d'arrivée → domicile |
| `latitude` / `longitude` | non | Fortement recommandés pour le livreur |
| `instructions` | non | 500 caractères max |

Réponse (`201`) : la mission créée, avec son `montant_fixe`.

Effets de bord : l'expédition est rattachée au compte
(`destinataire_user_id`) et marquée `livraison_payee_par_destinataire: true`.

Erreurs :
- `422` — une livraison à domicile est déjà prévue
- `422` — aucun tarif ne couvre cette distance, ou taux express non configuré
- `404` — l'expédition ne lui est pas destinée

**À faire :** afficher le prix avant confirmation, en réutilisant
`GET /api/expedition/client/grille-tarifs-enlevement` avec la commune de
l'agence d'arrivée.

### Payer le livreur

Le destinataire qui a demandé la livraison paie le livreur directement, hors
plateforme, puis dépose la preuve :

```http
POST /api/destinataire/preuves-paiement/payer-livreur
Content-Type: multipart/form-data
```

| Champ | Type | Requis |
|---|---|---|
| `mission_id` | uuid | oui |
| `montant` | number | oui |
| `methode_paiement` | string | oui |
| `reference_transaction` | string | non |
| `photo` | file | oui |

Autorisé seulement si l'expédition est marquée
`livraison_payee_par_destinataire`, que la mission est de type `livraison` et
que l'appelant est bien le destinataire enregistré. Sinon `403`.

Pour régler le reste (frais d'expédition, frais annexes), le destinataire
utilise la route générique `POST /api/destinataire/preuves-paiement`, de même
forme que celle du client (§3, étape 2).

---

## 5. Récapitulatif des endpoints

### Nouveaux

| Méthode | Endpoint | App |
|---|---|---|
| `GET` | `/api/expedition/client/agence/{agenceId}/moyens-paiement` | Client |
| `POST` | `/api/expedition/client/preuves-paiement` | Client |
| `GET` | `/api/expedition/client/{id}/preuves-paiement` | Client |
| `POST` | `/api/expedition/livreur/missions/{missionId}/accepter` | Livreur |
| `GET` | `/api/destinataire/mes-expeditions` | Client (destinataire) |
| `POST` | `/api/destinataire/rechercher` | Client (destinataire) |
| `POST` | `/api/destinataire/{id}/demander-livraison` | Client (destinataire) |
| `POST` | `/api/destinataire/preuves-paiement` | Client (destinataire) |
| `POST` | `/api/destinataire/preuves-paiement/payer-livreur` | Client (destinataire) |

### Modifiés

| Endpoint | Changement |
|---|---|
| `GET /api/profile/` | Nouveau champ `user.devise` |
| `GET /api/expedition/client/grille-tarifs-enlevement` | `montant` → `montant_standard`, ajout de `taux_express` et `montant_express` |
| `GET /api/expedition/livreur/missions-disponibles` | `montant_fixe` renseigné en express |
| `POST /api/expedition/client/{id}/demander-enlevement` | En express, prix imposé au lieu d'un appel à offres |
| `POST /api/expedition/client/{id}/demander-livraison` | Idem |

### Dépréciés — à retirer des apps

| Endpoint | Remplacement |
|---|---|
| `GET /api/expedition/client/missions/{missionId}/offres` | Plus d'offres en express |
| `POST /api/expedition/client/missions/{missionId}/offres/{offreId}/accepter` | Plus d'acceptation d'offre |
| `POST /api/expedition/livreur/missions/{missionId}/proposer` | `POST .../accepter` |
| `DELETE /api/expedition/livreur/missions/{missionId}/offre` | Plus d'offre à retirer |

Ces routes répondent toujours pour ne pas casser les versions déployées, mais
ne doivent plus être appelées par les nouvelles versions.

---

## Ordre d'implémentation conseillé

1. **Devise** — indépendant, débloque l'affichage correct partout.
2. **Express côté livreur** — le plus urgent : sans le bouton « Accepter », les
   livreurs ne peuvent plus prendre de course express.
3. **Express côté client** — affichage des deux prix.
4. **Preuves de paiement client** — nécessite les écrans de §3.
5. **Parcours destinataire** — fonctionnalité nouvelle, pas de régression si
   livrée plus tard.

Pour toute question sur un contrat d'API, se référer aussi à
`docs/API_LIVREUR.md` et `docs/api-enlevement-livraison-client.md`, qui
restent valables pour tout ce qui n'est pas listé ici.
