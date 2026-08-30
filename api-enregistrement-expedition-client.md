# API Enregistrement Expédition Client — `POST /api/expedition/client/store`

**Authentification** : requise (`auth:sanctum`), utilisateur de type `client` uniquement. Envoyer `Authorization: Bearer <token>` (token obtenu via `POST /api/login`).

Cette API fait suite au devis (`POST /api/expedition/client/devis`, voir `docs/api-devis-client.md`). Le client a déjà vu ses options de prix ; ici il valide définitivement sa demande. L'expédition créée apparaît immédiatement dans l'écran **"Demandes"** de l'agence de départ choisie (statut `en_attente`), en attente d'acceptation/refus par l'agence.

Le serveur **recalcule systématiquement le tarif** à partir des données brutes envoyées — il ne fait jamais confiance à un montant transmis par le client. Il est donc normal (et attendu) de renvoyer les mêmes données que celles utilisées pour le devis, pas le résultat du devis lui-même.

Comme pour le devis, il y a deux modes avec des structures différentes.

---

## Mode 1 — `livraison_domicile` (LD)

Crée **une seule expédition** de type `simple`.

### Entrée

```json
{
  "mode": "livraison_domicile",
  "code_pays_depart": "CI",
  "code_pays_destination": "FR",
  "agence_id": "d60b5ab0-f928-4bd7-a4ed-e7e8123b6b37",

  "expediteur_nom_prenom": "Jean Kouassi",
  "expediteur_telephone": "0102030405",
  "expediteur_email": "jean@example.com",
  "expediteur_adresse": "Rue 12",
  "expediteur_ville": "Bouaké",
  "expediteur_societe": null,
  "expediteur_code_postal": null,
  "expediteur_etat": null,
  "expediteur_quartier": null,

  "destinataire_nom_prenom": "Marie Dupont",
  "destinataire_telephone": "0601020304",
  "destinataire_email": null,
  "destinataire_adresse": "5 rue de Paris",
  "destinataire_ville": "Marseille",
  "destinataire_societe": null,
  "destinataire_code_postal": "13001",
  "destinataire_etat": null,
  "destinataire_quartier": null,

  "colis": [
    {
      "poids": 1.2,
      "longueur": 30,
      "largeur": 20,
      "hauteur": 15,
      "prix_emballage": 0,
      "articles": [
        { "produit_id": "e8b6a506-0e4b-4ac6-b286-4222489b652c" }
      ]
    }
  ]
}
```

| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `mode` | string | Oui | `"livraison_domicile"` |
| `code_pays_depart` / `code_pays_destination` | string (2 lettres) | Oui | Identiques au devis |
| `agence_id` | uuid | Oui | Agence de départ choisie, doit être active |
| `expediteur_*` | — | `nom_prenom`, `telephone`, `adresse`, `ville` **requis** ; `email`, `societe`, `code_postal`, `etat`, `quartier` optionnels | Saisie libre par le client (peut expédier pour un tiers) |
| `destinataire_*` | — | Mêmes règles que `expediteur_*` | |
| `colis[]` | array, min 1 | Oui | |
| `colis[].poids` | number | Oui, min 0.01 | kg |
| `colis[].longueur/largeur/hauteur` | number | Non | cm, sert au calcul du tarif (rapport poids/volume) |
| `colis[].prix_emballage` | number | Non | |
| `colis[].articles[].produit_id` | uuid | Non | Description du contenu uniquement, **aucun impact sur le prix** |

> Le sélecteur de produits pour ce mode doit utiliser `GET /api/produits?eligible_ld=1` (mêmes règles que pour le devis).

### Sortie — succès (201)

```json
{
  "success": true,
  "message": "Demande enregistrée avec succès.",
  "expedition": {
    "id": "3c24a6c0-7ee2-4c02-80c3-a7d9b5a1f3ca",
    "reference": "BKE-001202608280001",
    "type_expedition": "simple",
    "statut_expedition": "en_attente",
    "is_demande_client": true,
    "montant_expedition": "27825.00",
    "colis": [ { "code_colis": "LD-001-BKE001", "poids": "1.20", "...": "..." } ],
    "agence": { "nom_agence": "AGENCE BOUAKE", "...": "..." },
    "...": "tous les autres champs de l'expédition"
  }
}
```

### Sortie — échec (422)

```json
{ "success": false, "message": "Aucun tarif trouvé pour l'indice 1.5 vers cette destination pour l'un des colis." }
```

```json
{ "success": false, "message": "Agence invalide ou inactive." }
```

---

## Mode 2 — `recuperation_agence` (Groupage)

Peut créer **plusieurs expéditions en un seul appel** — une par catégorie de produit ayant un type d'expédition choisi. C'est une contrainte du modèle de données : une expédition ne porte qu'un seul `type_expedition`, donc si le client a des produits de catégories différentes destinés à des types différents (ex: une catégorie en DHD Aérien, une autre en CA), cela produit deux expéditions distinctes.

### Entrée

```json
{
  "mode": "recuperation_agence",
  "code_pays_depart": "CI",
  "code_pays_destination": "SN",
  "agence_id": "d60b5ab0-f928-4bd7-a4ed-e7e8123b6b37",
  "ville_depart": "abidjan",
  "ville_destination": "dakar",

  "expediteur_nom_prenom": "Jean Kouassi",
  "expediteur_telephone": "0102030405",
  "expediteur_email": null,
  "expediteur_adresse": "Rue 12",
  "expediteur_ville": "Bouaké",
  "expediteur_societe": null,
  "expediteur_code_postal": null,
  "expediteur_etat": null,
  "expediteur_quartier": null,

  "destinataire_nom_prenom": "Amadou Diop",
  "destinataire_telephone": "0770000000",
  "destinataire_email": null,
  "destinataire_adresse": "Rue 5",
  "destinataire_ville": "Dakar",
  "destinataire_societe": null,
  "destinataire_code_postal": null,
  "destinataire_etat": null,
  "destinataire_quartier": null,

  "colis": [
    {
      "articles": [
        { "produit_id": "82be688b-0c31-4cef-8b6e-102b7c9cfedb", "poids": 2.5 },
        { "produit_id": "35ec7b5e-679b-4a28-b6c6-70fa36a464bd", "poids": 1.0 }
      ]
    }
  ],

  "types_choisis": {
    "7dd51415-f771-43f6-96b0-a5829dfaad2e": "groupage_afrique"
  }
}
```

| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `mode` | string | Oui | `"recuperation_agence"` |
| `code_pays_depart` / `code_pays_destination` | string (2 lettres) | Oui | |
| `agence_id` | uuid | Oui | |
| `ville_depart` | string | Non | Utile pour DHD (ligne ville-ville) — prime sur la ville de l'agence si fournie |
| `ville_destination` | string | Requis pour tester DHD | Idem devis |
| `expediteur_*` / `destinataire_*` | — | Mêmes règles qu'en mode LD | |
| `colis[].articles[].produit_id` | uuid | Oui | Depuis `GET /api/produits` (catalogue complet, pas de filtre) |
| `colis[].articles[].poids` | number | Oui, min 0.01 | |
| `types_choisis` | object | Oui, min 1 clé | **Clé** = `category_id` (celui retourné par le devis dans `groupes[].category_id`), **valeur** = `type_expedition` choisi parmi ceux proposés dans `groupes[].types_eligibles[].type_expedition` pour ce groupe |

**Comment construire `types_choisis`** : après le devis, le frontend a reçu `groupes[]`, chacun avec son `category_id` et ses `types_eligibles[]`. Pour chaque groupe où le client a fait un choix (ou s'il n'y avait qu'un seul type éligible), ajouter l'entrée `{ [category_id]: type_expedition_choisi }`. Une catégorie absente de `types_choisis` est ignorée (aucune expédition créée pour elle).

Les articles envoyés ici doivent être **exactement les mêmes** que ceux du devis (mêmes `produit_id`/`poids`) — le serveur les re-regroupe par catégorie lui-même, il ne fait pas confiance à un regroupement pré-fait côté client.

### Sortie — succès total ou partiel (201 si au moins une expédition créée, 422 si aucune)

```json
{
  "success": true,
  "message": "Toutes les demandes ont été enregistrées avec succès.",
  "resultats": [
    {
      "category_id": "7dd51415-f771-43f6-96b0-a5829dfaad2e",
      "success": true,
      "expedition": {
        "id": "c6c7aa70-227a-414d-91fa-377adf858516",
        "reference": "BKE-001202608280002",
        "type_expedition": "groupage_afrique",
        "statut_expedition": "en_attente",
        "is_demande_client": true,
        "montant_expedition": "9450.00",
        "colis": [
          {
            "code_colis": "AF-001-BKE001",
            "poids": "3.50",
            "articles": [
              { "produit_id": "82be688b-0c31-4cef-8b6e-102b7c9cfedb", "poids": 2.5 },
              { "produit_id": "35ec7b5e-679b-4a28-b6c6-70fa36a464bd", "poids": 1 }
            ]
          }
        ]
      }
    }
  ]
}
```

`message` varie selon le résultat global :
- `"Toutes les demandes ont été enregistrées avec succès."` — tout a réussi.
- `"Certaines demandes ont été enregistrées, d'autres ont échoué."` — succès partiel (HTTP 201, il faut lire `resultats[]` pour savoir lesquelles ont échoué).
- `"Aucune demande n'a pu être enregistrée."` — échec total (HTTP 422).

Chaque entrée de `resultats[]` a `success: false` avec un `message` au lieu d'`expedition` si sa création a échoué (ex: plus de tarif disponible entre le devis et l'enregistrement) — les autres catégories du même appel ne sont pas affectées.

---

## Erreurs communes aux deux modes

**Non authentifié**
```
HTTP 500 { "success": false, "message": "Unauthenticated.", "error": "Unauthenticated." }
```
(comportement standard de toutes les routes protégées de cette API — pas spécifique à cet endpoint)

**Validation (422)**
```json
{ "success": false, "errors": { "expediteur_telephone": ["The expediteur telephone field is required."] } }
```

**Mode manquant/invalide (422)**
```json
{ "success": false, "errors": { "mode": ["Le mode doit être 'livraison_domicile' ou 'recuperation_agence'."] } }
```

**Agence invalide ou inactive (422)**
```json
{ "success": false, "message": "Agence invalide ou inactive." }
```

---

## Notes pour l'implémentation frontend

- **Toujours enchaîner devis → enregistrement**, jamais l'un sans l'autre : le devis sert à afficher les prix et les types possibles, l'enregistrement matérialise la demande.
- L'utilisateur doit être **connecté** pour appeler `store` (contrairement au devis, public). Prévoir l'inscription/connexion juste avant cette étape si le client ne l'est pas encore.
- En mode groupage, si un groupe n'avait qu'**un seul** type éligible au devis, il n'est pas nécessaire de demander un choix explicite au client — l'inclure quand même dans `types_choisis` avec ce type unique.
- Le champ `reference` de l'expédition créée (ex: `BKE-001202608280001`) est généré automatiquement et peut servir de numéro de suivi affiché au client.
- `code_colis` est généré côté serveur, pas besoin de le calculer côté client.
- Après un succès partiel en mode groupage, afficher clairement au client quelles catégories ont bien été enregistrées et lesquelles ont échoué (avec le `message` d'erreur associé) — ne pas faire croire que tout a été pris en compte.

---

## `GET /api/expedition/client/list`

**Authentification** : requise, client uniquement.

Liste complète (pas de pagination — même comportement que la liste des expéditions côté agence) des expéditions du client connecté, triées par date de création décroissante.

### Paramètres (query string, tous optionnels)

| Paramètre | Type | Description |
|---|---|---|
| `statut` | string | Filtre sur `statut_expedition` (ex: `en_attente`, `accepted`, `refused`, `cancelled`, `termined`, ...) |
| `type_expedition` | string | Filtre sur `type_expedition` (`simple`, `groupage_afrique`, `groupage_ca`, `groupage_dhd_aerien`, `groupage_dhd_maritime`) |
| `date_debut` | date (`YYYY-MM-DD`) | Filtre `created_at >= date_debut` |
| `date_fin` | date (`YYYY-MM-DD`) | Filtre `created_at <= date_fin` |

```
GET /api/expedition/client/list
GET /api/expedition/client/list?statut=en_attente
GET /api/expedition/client/list?type_expedition=groupage_afrique&date_debut=2026-08-01
```

### Sortie — succès (200)

`data` est un **tableau simple** (pas d'enveloppe de pagination), avec `agence` et `colis` chargés pour chaque expédition.

```json
{
  "success": true,
  "message": "Liste des expéditions récupérée avec succès",
  "data": [
    {
      "id": "13f30b49-1fab-4a91-ab9e-91df8e5cfa28",
      "reference": "BKE-001202608280001",
      "type_expedition": "simple",
      "statut_expedition": "en_attente",
      "montant_expedition": "27825.00",
      "expediteur": { "nom_prenom": "Jean K", "...": "..." },
      "destinataire": { "nom_prenom": "Marie D", "...": "..." },
      "colis": [ { "code_colis": "LD-001-BKE001", "...": "..." } ],
      "agence": { "nom_agence": "AGENCE BOUAKE", "...": "..." },
      "...": "tous les autres champs de l'expédition"
    }
  ]
}
```

---

## `GET /api/expedition/client/show/{id}`

**Authentification** : requise, client uniquement. Un client ne peut consulter que **ses propres** expéditions (isolation stricte par `user_id`, vérifié en test).

### Sortie — succès (200)

```json
{
  "success": true,
  "message": "Expédition récupérée avec succès",
  "data": { "id": "13f30b49-1fab-4a91-ab9e-91df8e5cfa28", "...": "tous les champs, agence + colis chargés" }
}
```

### Sortie — introuvable ou n'appartient pas au client (404)

```json
{ "success": false, "message": "Expédition non trouvée" }
```

---

## `PUT /api/expedition/client/cancel/{id}`

**Authentification** : requise, client uniquement.

Annule une expédition du client connecté, uniquement si son statut est encore `en_attente` ou `accepted` (avant tout traitement physique par l'agence). Passe le statut à `cancelled`.

### Entrée

```json
{ "motif_annulation": "Changement de plan" }
```

| Champ | Type | Obligatoire |
|---|---|---|
| `motif_annulation` | string, max 500 | Oui |

### Sortie — succès (200)

```json
{
  "success": true,
  "message": "Expédition annulée avec succès",
  "data": {
    "id": "13f30b49-1fab-4a91-ab9e-91df8e5cfa28",
    "statut_expedition": "cancelled",
    "motif_annulation": "Changement de plan",
    "date_annulation": "2026-08-28T10:25:00.000000Z",
    "...": "..."
  }
}
```

### Sortie — non trouvée / non éligible (404)

Retourné si l'expédition n'existe pas, n'appartient pas au client, ou n'est plus dans un statut annulable (déjà en cours de traitement, déjà annulée, etc.) :

```json
{ "success": false, "message": "Expédition non trouvée ou non éligible à l'annulation." }
```

### Sortie — validation (422)

```json
{ "success": false, "errors": { "motif_annulation": ["The motif annulation field is required."] } }
```

---

## `GET /api/expedition/client/statistics`

**Authentification** : requise, client uniquement.

Compteurs agrégés sur l'ensemble des expéditions du client connecté (tous statuts confondus, pas de filtre).

### Sortie — succès (200)

```json
{
  "success": true,
  "message": "Statistiques récupérées avec succès",
  "data": {
    "total": 5,
    "en_attente": 1,
    "accepted": 1,
    "refused": 0,
    "cancelled": 1,
    "en_cours": 2,
    "termined": 0,
    "montant_total": "142300.00",
    "montant_paye": "27825.00"
  }
}
```

| Champ | Description |
|---|---|
| `total` | Nombre total d'expéditions du client |
| `en_attente` / `accepted` / `refused` / `cancelled` / `termined` | Comptage par statut exact |
| `en_cours` | Regroupe tous les statuts intermédiaires de traitement (`en_cours_enlevement`, `en_cours_depot`, `recu_agence_depart`, `en_transit_entrepot`, `depart_expedition_succes`, `arrivee_expedition_succes`, `recu_agence_destination`, `en_cours_livraison`) — pratique pour un badge "en cours" unique côté UI sans exposer les 8 statuts individuellement |
| `montant_total` | Somme de `montant_expedition` sur toutes les expéditions du client |
| `montant_paye` | Somme de `montant_expedition` restreinte aux expéditions dont `statut_paiement = paye` |

---

## Endpoints associés (rappel)

| Endpoint | Auth | Usage |
|---|---|---|
| `GET /api/agences` / `GET /api/agences/{id}` | Non | Liste/profil des agences |
| `GET /api/produits` | Non | Catalogue produits (`?code_pays=`, `?eligible_ld=1`) |
| `POST /api/expedition/client/devis` | Non | Devis (voir `docs/api-devis-client.md`) |
| `POST /api/expedition/client/store` | Oui (client) | Enregistrement de la demande (documenté ci-dessus) |
| `GET /api/expedition/client/list` | Oui (client) | Liste des expéditions du client connecté |
| `GET /api/expedition/client/show/{id}` | Oui (client) | Détail d'une expédition du client |
| `PUT /api/expedition/client/cancel/{id}` | Oui (client) | Annulation d'une demande |
| `GET /api/expedition/client/statistics` | Oui (client) | Compteurs par statut + montants |
