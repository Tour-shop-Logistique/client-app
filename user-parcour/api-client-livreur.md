# API TourShop — App Client & App Livreur

Documentation à destination du développeur frontend des applications mobiles client et livreur.

**Base URL** : `https://<domaine>/api`  
**Authentification** : Bearer token Sanctum (`Authorization: Bearer <token>`) sauf routes marquées `[public]`.  
**Format** : JSON. Toutes les réponses ont `"success": true|false`.

---

## Suivi de colis (public)

### Suivre une expédition par code `[public]`

```
POST /expedition/suivi
```

Accessible sans compte. Throttle : 20 req/min par IP, 10 req/min par code.

**Body**
```json
{ "code": "CBL001DHDAE" }
```

**Réponse 200**
```json
{
  "success": true,
  "expedition": {
    "id": null,
    "reference": "CBL001DHDAE",
    "statut_expedition": "en_attente",
    "pays_depart": "CI",
    "pays_destination": "FR",
    "type_expedition": "groupage_dhd_aerien",
    "agence_depart": { "id": "...", "nom_agence": "...", "telephone": "...", "adresse": "...", "pays": "CI" },
    "agence_arrivee": { "id": "...", "nom_agence": "...", "telephone": "...", "adresse": "...", "pays": "FR" },
    "is_livraison_domicile": false,
    "created_at": "2026-11-01T08:00:00Z"
  }
}
```

> `id` est `null` sur la route publique. Pour les appels authentifiés suivants, utiliser `reference` comme identifiant.

---

## Format des codes d'expédition

| Type | Format | Exemple |
|------|--------|---------|
| Simple (LD) | `{CODE_AGENCE}{NNN}LD` | `CBL001LD` |
| Groupage Afrique | `{CODE_AGENCE}{NNN}GA` | `CBL042GA` |
| Colis Accompagné | `{CODE_AGENCE}{NNN}CA` | `CBL003CA` |
| DHD Aérien | `{CODE_AGENCE}{NNN}DHDAE` | `CBL001DHDAE` |
| DHD Maritime | `{CODE_AGENCE}{NNN}DHDMA` | `CBL001DHDMA` |
| Intervilles | `{CODE_AGENCE}{NNN}{2 initiales ville dest}` | `CBL001DA` (Daloa), `CBL002SP` (San Pedro) |

`NNN` = compteur global par agence, 3 chiffres, ne repart jamais à zéro.

---

## App Client

Toutes les routes client nécessitent un token Sanctum et un compte de type `CLIENT`.

### Expéditions

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/expedition/client/list` | Mes expéditions (paginé) |
| POST | `/expedition/client/store` | Créer une expédition |
| GET | `/expedition/client/show/{id}` | Détail d'une expédition |
| PUT | `/expedition/client/cancel/{id}` | Annuler une expédition |
| GET | `/expedition/client/statistics` | Statistiques |
| POST | `/expedition/client/{id}/demander-enlevement` | Demander un enlèvement |
| POST | `/expedition/client/{id}/demander-livraison` | Demander livraison à domicile |
| GET | `/expedition/client/{id}/missions` | Missions liées à une expédition |

### Destinataire — voir ses colis

```
POST /destinataire/rechercher
```
Requiert un compte authentifié **ou** la route publique `/expedition/suivi`.

```
GET /destinataire/mes-expeditions
```
Liste toutes les expéditions dont l'utilisateur est destinataire (par téléphone ou `destinataire_user_id`).

### Demande de livraison à domicile (destinataire)

```
POST /destinataire/livraison-domicile/{id}
```

**Body**
```json
{
  "mode": "express",
  "type_vehicule": "moto",
  "distance_km": 5.2,
  "latitude": 5.3567,
  "longitude": -4.0084,
  "instructions": "Appeler avant d'arriver"
}
```

### Notifications client

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/expedition/client/notifications` | Liste (paginée, 20/page) |
| POST | `/expedition/client/notifications/{id}/lue` | Marquer une notif comme lue |
| POST | `/expedition/client/notifications/tout-lire` | Tout marquer comme lu |
| DELETE | `/expedition/client/notifications/{id}` | Supprimer une notif |

**Structure d'une notification**
```json
{
  "id": "uuid",
  "type": "App\\Notifications\\ExpeditionEventPushNotification",
  "notifiable_type": "App\\Models\\User",
  "notifiable_id": "uuid",
  "data": {
    "type": "demande_acceptee",
    "titre": "Demande acceptée",
    "message": "Votre expédition CBL001LD a été acceptée par l'agence ...",
    "cible": { "type": "expedition", "id": "uuid" }
  },
  "read_at": null,
  "created_at": "2026-11-01T08:00:00Z"
}
```

**Types de notification client** (`data.type`) :

| Valeur | Déclencheur |
|--------|-------------|
| `demande_acceptee` | L'agence accepte la demande client |
| `demande_refusee` | L'agence refuse la demande client |
| `expedition_controlled` | Montant révisé après contrôle |
| `frais_annexes_updated` | Frais annexes ajoutés |
| `colis_receptionne_depart` | Colis reçus à l'agence de départ |
| `colis_livre` | Colis livré au destinataire |

---

## App Livreur

Toutes les routes livreur nécessitent un token Sanctum et un compte de type `LIVREUR`.

### Missions

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/livreur/missions` | Mes missions |
| GET | `/livreur/missions/{id}` | Détail d'une mission |
| POST | `/livreur/missions/{id}/accepter` | Accepter une mission |
| POST | `/livreur/missions/{id}/refuser` | Refuser une mission |
| POST | `/livreur/missions/{id}/demarrer` | Démarrer une mission |
| POST | `/livreur/missions/{id}/terminer` | Terminer une mission |

### Notifications livreur

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/livreur/notifications` | Liste (paginée, 20/page) |
| POST | `/livreur/notifications/{id}/lue` | Marquer une notif comme lue |
| POST | `/livreur/notifications/tout-lire` | Tout marquer comme lu |
| DELETE | `/livreur/notifications/{id}` | Supprimer une notif |

**Structure d'une notification** (même format que client, voir ci-dessus)

**Types de notification livreur** (`data.type`) :

| Valeur | Déclencheur |
|--------|-------------|
| `mission_assignee` | Mission assignée manuellement (groupage) |
| `mission_proposee` | Nouvelle mission proposée |
| `mission_express_disponible` | Mission express disponible |
| `mission_acceptee` | Confirmation d'acceptation |
| `mission_refusee` | Mission refusée/annulée |
| `inscription_validee` | KYC validé par le backoffice |
| `inscription_rejetee` | KYC rejeté |
| `retrait_confirme` | Retrait de solde confirmé |
| `retrait_rejete` | Retrait de solde rejeté |
| `abonnement_bloque` | Abonnement bloqué |
| `abonnement_echeance_proche` | Abonnement bientôt à renouveler |

---

## Push notifications (web push)

Les notifications sont envoyées à la fois via **web push** (si l'appareil a souscrit) et persistées en base (canal `database`). L'historique est accessible via les routes `/notifications` ci-dessus.

Pour souscrire au web push :

```
POST /webpush/subscriptions
```

```json
{
  "endpoint": "https://...",
  "keys": { "p256dh": "...", "auth": "..." }
}
```

---

## Codes de statut HTTP courants

| Code | Signification |
|------|---------------|
| 200 | Succès |
| 201 | Créé |
| 401 | Non authentifié |
| 403 | Non autorisé (mauvais type de compte) |
| 404 | Ressource introuvable |
| 422 | Données invalides (`errors` dans la réponse) |
| 429 | Trop de requêtes (throttle) |
| 500 | Erreur serveur |
