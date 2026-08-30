# API Devis Client — `POST /api/expedition/client/devis`

**Authentification** : aucune (route publique, hors `auth:sanctum`).

Le client choisit d'abord un **mode**, qui détermine tout le reste du comportement. Les deux modes ont des formats d'entrée et de sortie différents.

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
| `colis[]` | array, min 1 | Oui | Liste des colis physiques |
| `colis[].poids` | number | Oui, min 0.01 | Poids total du colis en kg |
| `colis[].longueur/largeur/hauteur` | number | Non | Dimensions en cm — servent au calcul du rapport poids/volume. Omis ou à 0 si inconnues (seul le poids compte alors) |
| `colis[].articles[]` | array | Non | Liste des produits contenus dans ce colis, **pour affichage/description uniquement** — n'entre pas dans le calcul du prix |
| `colis[].articles[].produit_id` | uuid | requis si `articles` fourni | Doit venir de `GET /api/produits?eligible_ld=1` |

> **Important** : le sélecteur de produits pour ce mode doit appeler `GET /api/produits?eligible_ld=1` afin de ne proposer que les produits réellement éligibles au LD — le client ne doit pas pouvoir mettre un produit interdit en LD dans un colis de ce mode.

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
| `ville_destination` | string | **Requis dès que la destination n'est pas un pays africain** (voir routage) | Nécessaire pour tester le DHD (ligne exacte ville-ville). Sans ce champ, le DHD n'est jamais proposé pour France/autres pays |
| `colis[].articles[].produit_id` | uuid | Oui | Depuis `GET /api/produits` (sans filtre `eligible_ld`, tous les produits sont valides ici) |
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
- En mode LD, toujours filtrer le sélecteur de produits avec `?eligible_ld=1` sur `GET /api/produits`.
- En mode groupage, pas de filtre nécessaire sur `GET /api/produits` — tous les produits sont sélectionnables, l'éligibilité par type est gérée automatiquement côté serveur au moment du devis.
- `ville_destination` doit être demandée dans le formulaire dès que le pays choisi n'est pas un pays africain (France ou "autre"), sinon le devis groupage risque de revenir systématiquement vide pour ces destinations.
- Le nom de la catégorie système CA est toujours `"Colis Accompagnés"` (`is_default: true` côté `GET /api/produits`), utile si vous voulez l'afficher différemment dans l'UI (badge spécifique, icône, etc.).

---

## Endpoints associés

### `GET /api/produits`

Catalogue public de produits (authentification : aucune).

| Paramètre | Type | Description |
|---|---|---|
| `code_pays` | string (2 lettres) | Filtre par pays (résout le backoffice correspondant) |
| `eligible_ld` | `1` / `true` | Ne retourne que les produits éligibles LD — à utiliser pour le mode `livraison_domicile` |

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

### `GET /api/agences` et `GET /api/agences/{id}`

Liste et profil public des agences (authentification : aucune), filtrable par `?code_pays=`.
