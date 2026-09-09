# API Devis Client — `POST /api/expedition/client/devis`

**Authentification** : aucune (route publique, hors `auth:sanctum`).

Le client choisit d'abord un **mode**, qui détermine tout le reste du comportement. Les deux modes ont des formats d'entrée et de sortie différents.

---

## `GET /api/expedition/client/pays-disponibles`

**Authentification** : aucune (route publique). **À appeler avant le devis**, pour ne proposer au client que des pays de destination réellement tarifés — sans ça, un pays sans aucun tarif configuré échouerait systématiquement au devis (`"Aucun tarif trouvé..."`/zone introuvable) sans que rien ne l'ait signalé plus tôt.

### Paramètres (query string)

| Paramètre | Type | Obligatoire | Notes |
|---|---|---|---|
| `code_pays` | string (code ISO, ex. `CI`) | Oui | Pays de **départ** — résout le backoffice émetteur |

```
GET /api/expedition/client/pays-disponibles?code_pays=CI
```

### Sortie — succès (200)

```json
{
  "success": true,
  "pays": [
    {
      "code_pays": "FR",
      "nom": "France",
      "ld": true,
      "groupage_afrique": false,
      "groupage_ca": false,
      "groupage_dhd_aerien": true,
      "groupage_dhd_maritime": false
    },
    {
      "code_pays": "SN",
      "nom": "Sénégal",
      "ld": false,
      "groupage_afrique": true,
      "groupage_ca": false,
      "groupage_dhd_aerien": false,
      "groupage_dhd_maritime": false
    }
  ]
}
```

Triés par nom. Chaque pays n'apparaît qu'une fois, avec un booléen par type indiquant s'il existe au moins un tarif actif de ce type vers ce pays, pour le backoffice résolu — utile pour afficher un badge par type dès le sélecteur de pays (ex. "France : LD + DHD Aérien disponibles"), sans avoir à appeler `/devis` pour chaque pays candidat.

Un pays qui a une zone configurée mais **aucun tarif actif** n'apparaît pas dans la liste (ex. une zone créée par anticipation, pas encore tarifée).

### Erreurs

**`code_pays` manquant (422)**
```json
{ "success": false, "message": "Le paramètre code_pays est requis." }
```

**Aucun backoffice actif pour ce pays (404)**
```json
{ "success": false, "message": "Aucun backoffice actif pour ce pays." }
```

---

## Mode 1 — `livraison_domicile` (LD)

Un seul devis, calculé **par colis** (poids + dimensions), pas par produit. Correspond exactement au fonctionnement déjà utilisé côté agence.

### Entrée

```json
{
  "mode": "livraison_domicile",
  "code_pays_depart": "CI",
  "code_pays_destination": "FR",
  "agence_id": "d60b5ab0-f928-4bd7-a4ed-e7e8123b6b37",
  "ville_depart": "Abidjan",
  "ville_destination": "Marseille",
  "colis": [
    {
      "poids": 1.2,
      "longueur": 30,
      "largeur": 20,
      "hauteur": 15,
      "articles": [
        { "produit_id": "e8b6a506-0e4b-4ac6-b286-4222489b652c" }
      ]
    },
    {
      "poids": 1.5,
      "longueur": 0,
      "largeur": 0,
      "hauteur": 0,
      "articles": []
    }
  ]
}
```

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `mode` | string | Oui | `"livraison_domicile"` |
| `code_pays_depart` | string (2 lettres) | Oui | Pays de départ |
| `code_pays_destination` | string (2 lettres) | Oui | Pays de destination |
| `agence_id` | uuid | Oui | Agence de départ, doit être active |
| `ville_depart` / `ville_destination` | string | Non | **Sans effet sur le calcul en mode LD** (le tarif LD est par zone/pays, pas par ville) — acceptés uniquement pour que le client les saisisse une seule fois ici et qu'ils soient réutilisables tels quels à l'étape `POST /api/expedition/client/store` (adresses expéditeur/destinataire), sans devoir les redemander. À afficher/collecter dans le même formulaire que le mode groupage où, eux, ils ont un vrai impact — voir plus bas. |
| `colis[]` | array, min 1 | Oui | Liste des colis physiques |
| `colis[].poids` | number | Oui, min 0.01 | Poids total du colis en kg |
| `colis[].longueur/largeur/hauteur` | number | Non | Dimensions en cm — servent au calcul du rapport poids/volume. Omis ou à 0 si inconnues (seul le poids compte alors) |
| `colis[].articles[]` | array | Non | Liste des produits contenus dans ce colis, **pour affichage/description uniquement** — n'entre pas dans le calcul du prix |
| `colis[].articles[].produit_id` | uuid | requis si `articles` fourni | Doit venir de `GET /api/produits`, filtré côté frontend sur `eligible_ld: true` (voir note ci-dessous) |

> **Important** : `GET /api/produits` ne filtre plus par éligibilité côté serveur — il retourne toujours le catalogue complet du pays, avec les 4 champs `eligible_ld`/`eligible_afrique`/`eligible_dhd_aerien`/`eligible_dhd_maritime`. C'est au **frontend** de filtrer localement sur `eligible_ld === true` pour construire le sélecteur de ce mode (le client ne doit pas pouvoir mettre un produit interdit en LD dans un colis de ce mode) — charger la liste une seule fois par pays et filtrer en mémoire à chaque changement de mode, plutôt que de refaire un appel réseau.

### Sortie — succès (200)

```json
{
  "success": true,
  "devis": {
    "type_expedition": "simple",
    "montant_base": 53000,
    "montant_prestation": 2650,
    "montant_expedition": 55650,
    "details_colis": [
      { "poids": 1.2, "indice_arrondi": 1.5, "montant_base": 26500, "montant_prestation": 1325, "frais_emballage": 0, "total": 27825 },
      { "poids": 1.5, "indice_arrondi": 1.5, "montant_base": 26500, "montant_prestation": 1325, "frais_emballage": 0, "total": 27825 }
    ]
  }
}
```

### Sortie — pas de tarif trouvé (422)

```json
{ "success": false, "message": "Aucun tarif trouvé pour l'indice 2.5 vers cette destination pour l'un des colis." }
```

---

## Mode 2 — `recuperation_agence` (Groupage)

Un ou plusieurs devis, calculés **par produit** (poids par article), regroupés par catégorie. Le ou les types testés dépendent strictement du pays de destination.

### Entrée

```json
{
  "mode": "recuperation_agence",
  "code_pays_depart": "CI",
  "code_pays_destination": "FR",
  "agence_id": "75ceb79f-94f9-4189-9a75-0f575c66dcde",
  "ville_depart": "Abidjan",
  "ville_destination": "marseille",
  "colis": [
    {
      "articles": [
        { "produit_id": "e8b6a506-0e4b-4ac6-b286-4222489b652c", "poids": 2.5 },
        { "produit_id": "82be688b-0c31-4cef-8b6e-102b7c9cfedb", "poids": 1.2 }
      ]
    }
  ]
}
```

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `mode` | string | Oui | `"recuperation_agence"` |
| `code_pays_depart` | string (2 lettres) | Oui | Pays de départ |
| `code_pays_destination` | string (2 lettres) | Oui | Pays de destination — pilote le routage (voir plus bas) |
| `agence_id` | uuid | Oui | Agence de départ, doit être active |
| `ville_depart` | string | Non | Ville de départ pour la ligne DHD (ville-ville) — **la ville de l'agence de départ (`agence.ville`) prime toujours** si elle est renseignée ; `ville_depart` ne sert que de repli si l'agence n'a pas de ville en base. En pratique, ce champ n'a donc d'effet que pour une agence sans ville configurée. |
| `ville_destination` | string | **Requis dès que la destination n'est pas un pays africain** (voir routage) | Nécessaire pour tester le DHD (ligne exacte ville-ville). Sans ce champ, le DHD n'est jamais proposé pour France/autres pays |
| `colis[].articles[].produit_id` | uuid | Oui | Depuis `GET /api/produits` — tous les produits sont valides pour ce mode, aucun filtre d'éligibilité à appliquer côté frontend ici (contrairement au mode LD) |
| `colis[].articles[].poids` | number | Oui, min 0.01 | Poids de cet article en kg |

### Routage géographique (automatique, pas de paramètre à envoyer pour ça)

| Destination | Types possibles |
|---|---|
| France (`FR`) | DHD Aérien et/ou Maritime (si `ville_destination` fourni) **+** CA (uniquement pour les produits de la catégorie système "Colis Accompagnés") |
| Pays africain | Groupage Afrique uniquement |
| Tout autre pays | DHD Aérien et/ou Maritime uniquement (si `ville_destination` fourni) |

Dans tous les cas, chaque type n'est réellement retourné que si un tarif est configuré ET que le produit est éligible à ce type précis (`eligible_afrique`, `eligible_dhd_aerien`, `eligible_dhd_maritime` sur le produit — CA n'a pas de champ d'éligibilité, tout produit de sa catégorie y est automatiquement éligible).

### Sortie — succès (200)

```json
{
  "success": true,
  "groupes": [
    {
      "category_id": "7dd51415-f771-43f6-96b0-a5829dfaad2e",
      "category_nom": "DENRÉES ALIMENTAIRES",
      "poids_total": 3.7,
      "articles": [
        { "produit_id": "e8b6a506-0e4b-4ac6-b286-4222489b652c", "poids": 2.5, "colis_index": 0 },
        { "produit_id": "82be688b-0c31-4cef-8b6e-102b7c9cfedb", "poids": 1.2, "colis_index": 0 }
      ],
      "types_eligibles": [
        {
          "type_expedition": "groupage_dhd_aerien",
          "montant_base": 38500,
          "montant_prestation": 1925,
          "montant_expedition": 40425,
          "poids_concerne": 3.7
        }
      ]
    }
  ]
}
```

| Champ | Description |
|---|---|
| `groupes[].category_id` / `category_nom` | Catégorie de produit ayant servi au regroupement |
| `groupes[].poids_total` | Somme des poids de tous les articles du groupe |
| `groupes[].articles[]` | Détail des articles avec leur `colis_index` d'origine |
| `groupes[].types_eligibles[]` | Un objet par type éligible et son prix. `poids_concerne` indique le sous-poids réellement utilisé pour ce type précis — peut être **inférieur** à `poids_total` si certains articles du groupe ne sont pas éligibles à ce type (ex: un produit interdit en DHD Aérien dans un groupe qui en contient d'autres) |

Un groupe peut avoir `types_eligibles: []` (aucun tarif configuré pour cette combinaison) — ce n'est pas une erreur.

---

## Erreurs communes aux deux modes

**Validation (422)**
```json
{ "success": false, "errors": { "agence_id": ["The selected agence id is invalid."] } }
```

**Mode manquant/invalide (422)**
```json
{ "success": false, "errors": { "mode": ["Le mode doit être 'livraison_domicile' ou 'recuperation_agence'."] } }
```

**Agence inactive (422)**
```json
{ "success": false, "message": "Agence invalide ou inactive." }
```

---

## Notes pour l'implémentation frontend

- Les deux modes utilisent des structures de `colis[]` **différentes** — ne pas réutiliser le même composant de formulaire tel quel entre les deux écrans.
- `GET /api/produits` ne filtre jamais par éligibilité côté serveur : charger la liste complète du pays **une seule fois**, puis filtrer côté frontend selon le mode actif. En mode LD, ne proposer que les produits avec `eligible_ld === true`. En mode groupage, pas de filtre nécessaire — tous les produits sont sélectionnables, l'éligibilité par type (`eligible_afrique`/`eligible_dhd_aerien`/`eligible_dhd_maritime`) est de toute façon revérifiée automatiquement côté serveur au moment du devis (voir le mode groupage plus haut).
- `ville_destination` doit être demandée dans le formulaire dès que le pays choisi n'est pas un pays africain (France ou "autre"), sinon le devis groupage risque de revenir systématiquement vide pour ces destinations.
- `ville_depart`/`ville_destination` sont **communs aux deux modes** dans le payload (mêmes noms de champs), mais avec un rôle différent : ignorés par le calcul en mode LD (juste transmis pour préremplir l'étape d'enregistrement ensuite), utilisés en mode groupage pour la ligne DHD — `ville_depart` seulement en repli, `ville_destination` toujours (il n'y a pas d'équivalent "ville de l'agence" côté destinataire). Un même champ de formulaire "ville de départ"/"ville de destination" peut donc être partagé entre les deux écrans sans dupliquer la saisie.
- Le nom de la catégorie système CA est toujours `"Colis Accompagnés"` (`is_default: true` côté `GET /api/produits`), utile si vous voulez l'afficher différemment dans l'UI (badge spécifique, icône, etc.).

---

## Endpoints associés

### `GET /api/expedition/client/pays-disponibles`

Voir section dédiée en tête de ce document — à appeler avant le devis pour ne proposer que des pays réellement tarifés.

### `GET /api/produits`

Catalogue public de produits (authentification : aucune). **À charger une seule fois** (par pays), pas à chaque changement de mode — voir "Notes pour l'implémentation frontend" ci-dessus.

| Paramètre | Type | Description |
|---|---|---|
| `code_pays` | string (2 lettres) | Filtre par pays (résout le backoffice correspondant) — seul filtre appliqué côté serveur |

Le paramètre `eligible_ld` n'existe plus côté serveur (retiré délibérément) : le filtrage par éligibilité est entièrement à la charge du frontend, à partir des 4 champs `eligible_*` de chaque produit dans la réponse.

Réponse :
```json
{
  "success": true,
  "products": [
    {
      "id": "e8b6a506-0e4b-4ac6-b286-4222489b652c",
      "category_id": "7dd51415-f771-43f6-96b0-a5829dfaad2e",
      "designation": "GINGEMBRE PILÉ",
      "reference": "GIN",
      "backoffice_id": "5453e2a3-5d3f-4780-aba3-28bba64d2016",
      "eligible_ld": true,
      "eligible_afrique": true,
      "eligible_dhd_aerien": true,
      "eligible_dhd_maritime": true,
      "category": {
        "id": "7dd51415-f771-43f6-96b0-a5829dfaad2e",
        "nom": "DENRÉES ALIMENTAIRES",
        "is_default": false
      }
    }
  ]
}
```

### `GET /api/agences`

Liste publique des agences **actives** (authentification : aucune, navigation libre avant inscription).

| Paramètre | Type | Description |
|---|---|---|
| `code_pays` | string (2 lettres) | Filtre par pays. Sans ce paramètre, retourne **toutes** les agences actives, tous pays confondus |

Réponse :
```json
{
  "success": true,
  "agences": [
    {
      "id": "d60b5ab0-f928-4bd7-a4ed-e7e8123b6b37",
      "nom_agence": "AGENCE BOUAKE",
      "description": null,
      "adresse": "Rue 12, Zone Commerciale",
      "ville": "Bouaké",
      "commune": null,
      "pays": "Côte d'Ivoire",
      "code_pays": "CI",
      "telephone": "0102030405",
      "email": null,
      "latitude": "7.69000000",
      "longitude": "-5.03000000",
      "zone_couverture_km": null,
      "horaires": null,
      "logo": null,
      "photos": [],
      "message_accueil": null
    }
  ]
}
```

Triée par `nom_agence`. Champs volontairement réduits à ceux utiles à un client (pas de `user_id`, ni de `code_agence` — celui-ci sert à l'inscription d'un compte agence, pas à un usage client).

### `GET /api/agences/{id}`

Profil public d'**une** agence active. Même forme d'objet `agence` que ci-dessus (`toPublicArray()`), directement (pas dans un tableau).

**Sortie — succès (200)**
```json
{ "success": true, "agence": { "id": "d60b5ab0-...", "nom_agence": "AGENCE BOUAKE", "...": "..." } }
```

**Sortie — introuvable ou inactive (404)**
```json
{ "success": false, "message": "Agence introuvable." }
```
Message identique dans les deux cas (agence inexistante ou simplement désactivée) — volontaire, pour ne jamais révéler qu'une agence existe mais a été désactivée.
