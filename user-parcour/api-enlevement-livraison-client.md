# API Enlèvement, Livraison à Domicile et Offres Client

Toutes les routes de ce document exigent un token (`Authorization: Bearer <token>`) et sont réservées aux comptes `client` (403 sinon).

Deux notions distinctes à ne pas confondre :
- **Enlèvement** : le livreur récupère le colis chez le client pour l'apporter à l'agence de départ.
- **Livraison à domicile (LD)** : le livreur livre le colis chez le destinataire, depuis l'agence d'arrivée.

Une expédition peut demander l'un, l'autre, les deux, ou aucun (retrait en agence classique).

---

## Deux modes de traitement — `groupage` vs `express`

Le champ `mode` (obligatoire sur les deux endpoints de demande ci-dessous) détermine comment la course est confiée à un livreur — **choix fait une fois pour toutes à la demande, jamais modifiable ensuite** :

| Mode | Fonctionnement | Tarif |
|---|---|---|
| `groupage` | Le backoffice assigne manuellement un livreur qui lui est rattaché. | Fixe, résolu automatiquement par une grille de tranches km/véhicule (voir `distance_km`/`type_vehicule` ci-dessous). |
| `express` | Diffusé aux livreurs indépendants (marketplace), qui proposent chacun un prix. Le client compare et choisit — voir la section Offres plus bas. | Négocié : le prix accepté par le client remplace tout tarif fixe pour cette course. |

`distance_km`/`type_vehicule` ne sont utiles qu'en mode `groupage` (ignorés en pratique en mode `express`, où il n'y a pas de grille à résoudre) mais restent acceptés dans les deux cas sans erreur.

---

## `GET /api/expedition/client/grille-tarifs-enlevement`

**Authentification** : requise, client uniquement. Permet à l'app cliente de calculer/afficher elle-même le montant avant que le client ne confirme sa demande d'enlèvement ou de livraison à domicile (mode `groupage`) — **à appeler avant** `demander-enlevement`/`demander-livraison` pour afficher un prix indicatif, la même grille étant ensuite appliquée réellement côté serveur au moment de la création de la mission.

### Paramètres (query string)

| Paramètre | Type | Obligatoire | Notes |
|---|---|---|---|
| `commune_id` | uuid | Oui | Commune de l'agence concernée (départ pour un enlèvement, arrivée pour une livraison à domicile) — doit exister dans `communes` |

```
GET /api/expedition/client/grille-tarifs-enlevement?commune_id=uuid-commune-bouake
```

### Sortie — succès (200)

```json
{
  "success": true,
  "data": [
    { "type_vehicule": "moto", "km_min": 0, "km_max": 5, "montant": 1000 },
    { "type_vehicule": "moto", "km_min": 5, "km_max": 10, "montant": 1500 },
    { "type_vehicule": "voiture", "km_min": 0, "km_max": 5, "montant": 2000 }
  ]
}
```

Une seule grille par `(commune, type_vehicule)`, partagée entre l'usage enlèvement et l'usage livraison à domicile — triée par `type_vehicule` puis `km_min`. Seules les tranches actives (`actif: true`) sont retournées. Un tableau vide est possible si aucune grille n'a été configurée pour cette commune (pas une erreur) : dans ce cas, `demander-enlevement`/`demander-livraison` échoueront en 422 si `distance_km` est transmis.

### Erreurs

**`commune_id` manquant ou invalide (422)**
```json
{ "success": false, "errors": { "commune_id": ["The commune id field is required."] } }
```

---

## `POST /api/expedition/client/{id}/demander-enlevement`

### Entrée

```json
{
  "mode": "groupage",
  "distance_km": 4.2,
  "type_vehicule": "moto",
  "latitude": 7.6905,
  "longitude": -5.0300,
  "instructions": "Portail bleu, sonner deux fois"
}
```

| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `mode` | string | Oui | `groupage` \| `express` |
| `distance_km` | number ≥ 0 | Non | Distance routière (calculée côté app, ex. Google/Mapbox Directions) entre l'agence de départ et le point d'enlèvement — nécessaire pour résoudre le tarif fixe en mode `groupage` |
| `type_vehicule` | string | Non | `moto` \| `voiture` — avec `distance_km`, détermine quelle grille de tranches appliquer |
| `latitude` | number, entre -90 et 90 | Non | Latitude du point d'enlèvement (chez l'expéditeur) — enregistrée sur `Expedition.expediteur_latitude`. Optionnelle mais fortement recommandée : sans elle, le livreur n'a que l'adresse texte de l'expéditeur pour sa navigation GPS |
| `longitude` | number, entre -180 et 180 | Non | Longitude du point d'enlèvement — `Expedition.expediteur_longitude` |
| `instructions` | string, max 500 | Non | Instructions de remise à l'intention du livreur (ex. repère visuel, étage, code portail) — `Expedition.instructions_enlevement` |

### Comportement

- Bloque (422) s'il existe déjà une mission d'enlèvement en cours (`en_attente` ou `assignee`) pour cette expédition — un seul enlèvement actif à la fois.
- Si `distance_km` est fourni, il est aussi enregistré sur l'expédition (`distance_domicile_agence`) — pas seulement utilisé pour ce calcul ponctuel. Idem pour `latitude`/`longitude`/`instructions`, enregistrés sur l'expédition dès qu'ils sont fournis (indépendamment du succès de la création de la mission).
- Marque `Expedition.is_enlevement_domicile = true`.

### Sortie — succès (201)

```json
{
  "success": true,
  "message": "Demande d'enlèvement transmise au backoffice.",
  "mission": {
    "id": "uuid-mission",
    "expedition_id": "uuid-expedition",
    "type": "enlevement",
    "mode": "groupage",
    "statut": "en_attente",
    "livreur_id": null,
    "montant_fixe": 1500.0,
    "montant_final": null,
    "type_vehicule": "moto",
    "statut_paiement": "en_attente",
    "assignee_le": null,
    "created_at": "2026-09-08T10:00:00.000000Z"
  }
}
```

`message` vaut `"Demande d'enlèvement diffusée aux livreurs."` en mode `express` — sert à distinguer l'écran à afficher côté app (attente d'assignation backoffice vs. attente d'offres à comparer).

`montant_fixe` est `null` en mode `express` tant qu'aucune offre n'est acceptée (voir plus bas) ; en mode `groupage`, résolu immédiatement si `distance_km`/`type_vehicule` couvrent une grille existante, sinon `null` aussi.

### Erreurs

**Demande déjà en cours (422)**
```json
{ "success": false, "message": "Une demande d'enlèvement est déjà en cours pour cette expédition." }
```

**Distance hors de toute tranche définie pour la commune (422)**
```json
{ "success": false, "message": "..." }
```
Message exact variable selon la grille manquante — erreur bloquante assumée, pas de fallback silencieux sur un montant par défaut.

**Expédition non trouvée / n'appartient pas au client connecté (404)**
```json
{ "success": false, "message": "Expédition non trouvée." }
```

---

## `POST /api/expedition/client/{id}/demander-livraison`

Symétrique à `demander-enlevement`, pour la livraison à domicile depuis l'agence d'arrivée.

### Entrée

```json
{
  "mode": "express",
  "distance_km": 6.8,
  "type_vehicule": "voiture",
  "latitude": 7.6845,
  "longitude": -5.0211,
  "instructions": "Immeuble gris, 3e étage"
}
```

Mêmes champs que ci-dessus (`distance_km` mesure ici la distance entre l'agence d'arrivée et le destinataire, enregistrée sur `distance_livraison_agence` ; `latitude`/`longitude`/`instructions` concernent le point de livraison chez le destinataire, enregistrés sur `Expedition.destinataire_latitude`/`destinataire_longitude`/`instructions_livraison`).

### Comportement

Identique à l'enlèvement (une seule demande de livraison active à la fois par expédition, marque `Expedition.is_livraison_domicile = true`).

### Sortie — succès (201)

```json
{
  "success": true,
  "message": "Demande de livraison à domicile diffusée aux livreurs.",
  "mission": { "id": "uuid-mission", "type": "livraison", "mode": "express", "statut": "en_attente", "...": "..." }
}
```

### Erreurs

Mêmes cas que `demander-enlevement` (message adapté : `"Une demande de livraison à domicile est déjà en cours pour cette expédition."`).

---

## Offres reçues (mode `express` uniquement)

En mode `groupage`, ces deux endpoints n'ont pas d'usage : le backoffice assigne directement, il n'y a jamais d'offre à consulter côté client (`offres` renverra une liste vide, pas une erreur).

### `GET /api/expedition/client/missions/{missionId}/offres`

Liste les offres **actives** (statut `active` — retirées ou déjà refusées exclues) reçues sur une mission qui appartient à une expédition du client connecté, triées par prix croissant.

**Sortie — succès (200)**
```json
{
  "success": true,
  "offres": [
    {
      "id": "uuid-offre",
      "mission_id": "uuid-mission",
      "livreur_id": "uuid-livreur",
      "montant_propose": 1200.0,
      "statut": "active",
      "created_at": "2026-09-08T10:05:00.000000Z",
      "livreur": { "id": "uuid-livreur", "nom": "Traoré", "prenoms": "Ali", "telephone": "0102030405" }
    }
  ]
}
```

**Sortie — mission non trouvée / n'appartient pas au client (404)**
```json
{ "success": false, "message": "Mission non trouvée." }
```
Se produit aussi si `missionId` existe mais est en mode `groupage` (le filtrage exclut ce mode par construction).

### `POST /api/expedition/client/missions/{missionId}/offres/{offreId}/accepter`

Accepte une offre : clôture la mission avec ce montant, **refuse automatiquement toutes les autres offres actives** sur cette mission (elles passent à `retiree`/`refusee` côté serveur, rien à faire côté app pour ça).

**Sortie — succès (200)**
```json
{
  "success": true,
  "message": "Offre acceptée.",
  "mission": {
    "id": "uuid-mission", "statut": "assignee", "livreur_id": "uuid-livreur",
    "montant_final": 1200.0, "assignee_le": "2026-09-08T10:10:00.000000Z", "...": "..."
  }
}
```

**Erreurs (404, dans les deux cas — pas de distinction de message)**
```json
{ "success": false, "message": "Mission non trouvée ou déjà clôturée." }
```
```json
{ "success": false, "message": "Offre non trouvée ou déjà retirée." }
```
Le premier cas couvre aussi : mission dans un autre statut que `en_attente` (déjà assignée par acceptation d'une autre offre entre-temps, ou annulée) — à gérer côté app comme "cette demande n'est plus disponible, rafraîchir la liste".

---

---

## `GET /api/expedition/client/{id}/missions`

Liste les missions (enlèvement et/ou livraison à domicile) liées à une expédition du client connecté, avec leur preuve (photo, signature, géolocalisation) si l'étape a déjà été réalisée par le livreur. Permet aussi de retrouver le `missionId` nécessaire pour `GET .../offres` ci-dessus.

### Sortie — succès (200)

```json
{
  "success": true,
  "message": "Missions de l'expédition récupérées avec succès",
  "data": [
    {
      "id": "uuid-mission",
      "expedition_id": "uuid-expedition",
      "type": "enlevement",
      "mode": "express",
      "statut": "assignee",
      "livreur_id": "uuid-livreur",
      "montant_fixe": null,
      "montant_final": 1200.0,
      "montant": 1200.0,
      "type_vehicule": "moto",
      "assignee_le": "2026-09-08T10:10:00.000000Z",
      "preuve": { "photo": "https://.../preuve.jpg", "signature": null, "latitude": 7.69, "longitude": -5.03 },
      "livreur": { "nom": "Traoré", "prenoms": "Ali", "telephone": "0102030405", "type_vehicule": "moto" },
      "...": "..."
    }
  ]
}
```

| Champ | Notes |
|---|---|
| `montant` | Ajouté par cet endpoint (absent du modèle brut) — vaut `montant_final` s'il est renseigné, sinon `montant_fixe`. Pratique pour afficher un seul montant sans avoir à choisir entre les deux champs côté app. |
| `livreur` | Objet `{ nom, prenoms, telephone, type_vehicule }` **uniquement si la mission a le statut `assignee`** (un livreur réellement rattaché) — `null` tant que la mission est `en_attente` (simple proposition groupage, ou offres express pas encore acceptées) : l'app ne doit pas afficher de contact à joindre avant cette étape, puisque personne n'a encore confirmé. |
| `preuve` | Preuve de réalisation (photo, signature, géolocalisation) enregistrée par le livreur à l'étape concernée — `null`/absente si l'étape n'a pas encore eu lieu. |

### Erreurs

**Expédition non trouvée (404)**
```json
{ "success": false, "message": "Expédition non trouvée" }
```

---

## `POST /api/expedition/client/missions/{missionId}/annuler`

Annule une mission d'enlèvement ou de livraison à domicile en cours (par exemple si le client change d'avis avant qu'un livreur ne soit assigné, ou pour renoncer à une demande express avant d'accepter une offre).

### Sortie — succès (200)

```json
{ "success": true, "message": "Mission annulée.", "mission": { "id": "uuid-mission", "statut": "annulee", "...": "..." } }
```

### Erreurs

**Mission non trouvée / n'appartient pas au client / non annulable (404)**
```json
{ "success": false, "message": "Mission non trouvée." }
```

---

## Notes pour l'implémentation frontend

- Aucun endpoint de suivi/notification temps réel dédié à l'arrivée d'une nouvelle offre n'est documenté ici — l'app doit re-poller `GET .../offres` (ou s'appuyer sur le canal WebSocket applicatif général, voir `WEBSOCKETS.md` — canal `client.{id}`, événement `Mission/etape`).
- `distance_km` doit être calculé côté app (aucun calcul d'itinéraire n'est fait côté serveur) — utiliser un service de directions externe entre les coordonnées de l'agence concernée (déjà disponibles via `GET /api/agences/{id}`) et l'adresse client.
- En mode `groupage`, afficher un état "en attente d'assignation par l'agence" sans notion de prix à comparer ; en mode `express`, afficher la liste d'offres avec bouton "Accepter" par ligne.
- `latitude`/`longitude` sur les demandes d'enlèvement/livraison sont optionnelles mais fortement recommandées : sans elles, le livreur navigue uniquement à l'adresse texte.
- Appeler `GET grille-tarifs-enlevement` avant d'afficher le formulaire de demande en mode `groupage`, pour prévenir le client du coût avant confirmation plutôt que de le découvrir après un 422 "hors de toute tranche définie".

---

## Factures et évaluation (rappel — voir `docs/api-enregistrement-expedition-client.md` pour le détail)

| Endpoint | Méthode | Usage |
|---|---|---|
| `/api/expedition/client/factures` | GET | Liste des factures du client, toutes expéditions confondues |
| `/api/expedition/client/factures/{id}/download` | GET | Téléchargement du PDF d'une facture |
| `/api/expedition/client/{id}/evaluation` | GET | Consulter l'évaluation déjà laissée sur une expédition |
| `/api/expedition/client/{id}/evaluation` | POST | Évaluer le service (uniquement si l'expédition est `termined`, une fois par expédition) |

---

## Endpoints associés (rappel)

| Endpoint | Méthode | Usage |
|---|---|---|
| `/api/expedition/client/grille-tarifs-enlevement` | GET | Grille tarifaire enlèvement/livraison par tranche de km (mode groupage) |
| `/api/expedition/client/{id}/demander-enlevement` | POST | Demander l'enlèvement à domicile d'une expédition |
| `/api/expedition/client/{id}/demander-livraison` | POST | Demander la livraison à domicile d'une expédition |
| `/api/expedition/client/{id}/missions` | GET | Lister les missions (enlèvement/livraison) d'une expédition, avec preuve et contact livreur |
| `/api/expedition/client/missions/{missionId}/offres` | GET | Lister les offres actives (mode express) |
| `/api/expedition/client/missions/{missionId}/offres/{offreId}/accepter` | POST | Accepter une offre |
| `/api/expedition/client/missions/{missionId}/annuler` | POST | Annuler une mission d'enlèvement/livraison en cours |
