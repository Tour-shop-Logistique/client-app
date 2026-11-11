# API Devis Client — `POST /api/expedition/client/devis`

**Authentification** : aucune (route publique, hors `auth:sanctum`).

Le client choisit d'abord un **mode**, qui détermine tout le reste du comportement. Les deux modes ont des formats d'entrée et de sortie différents.

## Endpoints du parcours devis (vue d'ensemble)

Toutes les URL sont préfixées par `/api`. « Public » = pas de token.

| # | Méthode | URL | Auth | Rôle | Documenté |
|---|---|---|---|---|---|
| 1 | GET | `/expedition/client/pays-disponibles` | Public | Pays de destination réellement tarifés | ce fichier |
| 2 | GET | `/produits` | Public | Produits / catégories (éligibilité LD, catégorie CA) | ce fichier |
| 3 | GET | `/agences`, `/agences/{id}` | Public | Agences de départ / d'arrivée | ce fichier |
| 4 | GET | `/communes` | Public | Communes (destination Interville, commune de départ/arrivée) | `api-simulation-et-formats-client.md` |
| 5 | GET | `/expedition/client/formats-colis` | Public | Seuils de format de colis (Interville) | `api-simulation-et-formats-client.md` |
| 6 | **POST** | **`/expedition/client/devis`** | Public | **Devis** : `mode = livraison_domicile` (LD) ou `recuperation_agence` (groupage Afrique/CA/DHD) | ce fichier |
| 7 | POST | `/expedition/client/simulate-interville` | Public | Devis **Interville** (national) | `api-simulation-et-formats-client.md` |
| 8 | GET | `/grille-tarifs-enlevement` | Public | Grille de tarifs d'enlèvement / livraison à domicile par km | `api-enlevement-livraison-client.md` |
| 9 | POST | `/expedition/client/store` | Token client | Enregistrer l'expédition après le devis | `api-enregistrement-expedition-client.md` |

Le prix calculé aux endpoints 6 et 7 tient compte des **promotions de tarif** du backoffice (voir `api-promotions-tarifs.md`).

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
      "groupage_ca": false,
      "groupage_dhd_aerien": true,
      "groupage_dhd_maritime": false
    },
    {
      "code_pays": "SN",
      "nom": "Sénégal",
      "ld": false,
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

### Endpoint

`POST /api/expedition/client/devis` — public, corps JSON avec `"mode": "livraison_domicile"`.

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

> **Important** : `GET /api/produits` ne filtre pas par éligibilité côté serveur — il retourne le catalogue complet du pays, avec les champs `eligible_ld`/`eligible_dhd_aerien`/`eligible_dhd_maritime`. C'est au **frontend** de filtrer localement sur `eligible_ld === true` pour construire le sélecteur de ce mode (le client ne doit pas pouvoir mettre un produit interdit en LD dans un colis de ce mode) — charger la liste une seule fois par pays et filtrer en mémoire à chaque changement de mode, plutôt que de refaire un appel réseau.

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

### Endpoint

`POST /api/expedition/client/devis` — **même URL que le mode 1**, public, corps JSON avec `"mode": "recuperation_agence"`.

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
| `destinataire_commune_id` | uuid | Recommandé | Commune de destination (référentiel structuré). Prioritaire sur `ville_destination` pour trouver la ligne DHD / CA |
| `ville_destination` | string | **Requis si `destinataire_commune_id` n'est pas fourni** (voir routage) | Ville de destination, en repli de `destinataire_commune_id`. Sans l'un des deux, ni le DHD ni le CA ne peuvent être proposés (ils dépendent de la ligne départ-destination) |
| `colis[].articles[].produit_id` | uuid | Oui | Depuis `GET /api/produits` — tous les produits sont valides pour ce mode, aucun filtre d'éligibilité à appliquer côté frontend ici (contrairement au mode LD) |
| `colis[].articles[].poids` | number | Oui, min 0.01 | Poids de cet article en kg |
| `types_choisis` | objet `{ category_id: type_expedition }` | Non | **Second appel** : une fois que le client a coché ses offres, renvoyer le même devis avec ce champ pour obtenir le **prix réel final** (`expeditions_prevues[]` + `montant_total`, voir sortie). Sans ce champ, ces deux clés sont absentes. Valeurs : `groupage_dhd_aerien`, `groupage_dhd_maritime`, `groupage_ca` |

### Routage géographique (automatique, pas de paramètre à envoyer pour ça)

**Aucun type n'est réservé à un pays en particulier** (la France n'a plus de régime à part) : ce qui est proposé dépend uniquement des **tarifs configurés par le backoffice** sur la ligne départ → destination.

| Type | Destination | Produits concernés |
|---|---|---|
| DHD Aérien | Tout pays, si un tarif DHD Aérien existe sur la ligne | Produits hors catégorie CA, avec `eligible_dhd_aerien` |
| DHD Maritime | Tout pays, si un tarif DHD Maritime existe sur la ligne, **et à partir de 50 kg** | Produits hors catégorie CA, avec `eligible_dhd_maritime` |
| CA (Colis Accompagnés) | Tout pays, si un tarif CA existe sur la ligne (ex: Allemagne si le backoffice a défini un tarif CA vers l'Allemagne) | Produits de la catégorie système CA (`is_default: true`) — pas de champ d'éligibilité |

DHD et CA ont besoin de la destination (`destinataire_commune_id` ou `ville_destination`) pour trouver la ligne.

Exemple : vers l'Allemagne, avec des produits CA et des produits hors CA, et des tarifs DHD Aérien, DHD Maritime et CA définis sur la ligne, le client voit les offres `DHD_AERIEN`, `DHD_MARITIME` (si ≥ 50 kg), `CA` et `CA_COMBINE` — exactement comme vers la France.

### Sortie — succès (200)

**Un seul appel `POST /api/expedition/client/devis` (mode `recuperation_agence`) renvoie tout.** Il n'y a pas d'endpoint séparé pour les offres. La réponse contient :

| Clé racine | Toujours présente | Contenu |
|---|---|---|
| `success` | oui | `true` |
| `groupes[]` | oui | Prix **par catégorie** (conservé pour compatibilité, ne plus l'utiliser pour afficher les prix) |
| **`offres[]`** | **oui** | **Les offres à proposer au client** (DHD Aérien, DHD Maritime, CA, CA combiné) avec leur prix par expédition — voir section « Offres DHD / CA » plus bas. Peut être `[]` |
| `expeditions_prevues[]` | seulement si `types_choisis` est envoyé en entrée | Une entrée par expédition qui sera créée au store (même structure que `offres[].expedition`) |
| `montant_total` | seulement si `types_choisis` est envoyé | Somme des `montant_expedition` de `expeditions_prevues[]` = prix final à afficher |

Parcours conseillé : (1) appel sans `types_choisis` → afficher `offres[]` ; (2) le client coche ses offres ; (3) rappel du même endpoint avec `types_choisis` fusionné → afficher `montant_total` ; (4) `POST /api/expedition/client/store` avec les mêmes `types_choisis`.

Extrait (les champs de `offres[]` sont détaillés plus bas) :

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
  ],
  "offres": [ "… voir « Offres DHD / CA — offres[] » …" ],
  "expeditions_prevues": [ "… seulement si types_choisis envoyé …" ],
  "montant_total": 0
}
```

| Champ | Description |
|---|---|
| `groupes[].category_id` / `category_nom` | Catégorie de produit ayant servi au regroupement |
| `groupes[].poids_total` | Somme des poids de tous les articles du groupe |
| `groupes[].articles[]` | Détail des articles avec leur `colis_index` d'origine |
| `groupes[].types_eligibles[]` | Un objet par type éligible et son prix. `poids_concerne` indique le sous-poids réellement utilisé pour ce type précis — peut être **inférieur** à `poids_total` si certains articles du groupe ne sont pas éligibles à ce type (ex: un produit interdit en DHD Aérien dans un groupe qui en contient d'autres) |

Un groupe peut avoir `types_eligibles: []` (aucun tarif configuré pour cette combinaison) — ce n'est pas une erreur.

### Offres DHD / CA — `offres[]`

> **D'où vient `offres[]` ?** C'est la clé `offres` de la réponse de `POST /api/expedition/client/devis` avec `"mode": "recuperation_agence"` (même appel que `groupes[]`, voir « Sortie — succès » ci-dessus). Aucun autre endpoint à appeler.

> **Affichage recommandé : par expédition, pas par catégorie.** Chaque offre correspond à **une expédition** (un seul type d'expédition, une facture) qui regroupe toutes les catégories partant dans ce type (ex: Denrées alimentaires + Divers en DHD Aérien = une seule expédition DHD Aérien, un seul prix). Afficher le prix de chaque offre, avec `expedition.detail_categories[]` en détail dépliable. `groupes[].types_eligibles[]` (prix par catégorie) reste renvoyé pour compatibilité mais ne doit plus servir à l'affichage des prix.

**Toujours renvoyé en mode `recuperation_agence`, quel que soit le pays de destination** (le CA n'est pas limité à un pays en particulier : il est proposé dès qu'un tarif CA existe sur la ligne). Un panier peut mélanger des produits de la catégorie système **« Colis Accompagnés »** (CA) et des produits d'autres catégories (Denrées alimentaires, Divers…, dits « hors CA », qui partent en **DHD**).

#### Offres possibles

| `code` | Contenu | Prix |
|---|---|---|
| `DHD_AERIEN` / `DHD_MARITIME` | Tous les produits hors CA | Somme des catégories (poids × tarif DHD). **Si le total est sous le minimum de la ligne, c'est le minimum qui est facturé** (`minimum_applique: true`) |
| `CA` | Les produits Colis Accompagnés | Poids CA × tarif CA de la ligne |
| `CA_COMBINE` | **Tout le panier** (hors CA + CA) en une seule expédition CA | **Poids total** × tarif CA de la ligne |

Selon le panier :

| Contenu du panier | Offres renvoyées |
|---|---|
| Uniquement des produits CA | `CA` |
| Uniquement des produits hors CA | `DHD_AERIEN`, `DHD_MARITIME` — selon tarifs et éligibilité |
| Mélange CA + hors CA | les offres hors CA, `CA`, et `CA_COMBINE` |

Seules les offres dont le prix a pu être calculé sont renvoyées. Une offre hors CA n'apparaît que si **tous** les produits hors CA sont éligibles à ce type (`eligible_dhd_aerien` / `eligible_dhd_maritime`) et qu'un tarif existe.

**DHD Maritime : minimum 50 kg.** Le maritime n'est proposé (dans `offres[]` comme dans `groupes[].types_eligibles[]`) que si le poids total des produits hors CA éligibles au maritime atteint **50 kg**. En dessous, seul le DHD Aérien apparaît. L'enregistrement d'une expédition maritime sous 50 kg est refusé avec le message « Le DHD Maritime nécessite un poids total d'au moins 50 kg… ».

#### Sélection par le client (cases à cocher)

Le client **coche** les offres qu'il veut. Règles :

- Il peut cocher **une offre hors CA + l'offre CA** : 2 expéditions, 2 factures, montant affiché = somme des deux. Les codes cumulables avec une offre sont donnés par `cumulable_avec[]`.
- Les offres hors CA entre elles (`DHD_AERIEN`, `DHD_MARITIME`) ne sont **jamais** cumulables : elles portent sur les mêmes produits, il en choisit une seule.
- `CA_COMBINE` est **exclusive** (`cumulable_avec: []`) : cocher `CA_COMBINE` décoche tout le reste, et inversement.
- **Ne pas pré-sélectionner ni recommander d'offre** : le client compare et choisit (ex: `DHD_AERIEN` 16 530 + `CA` 12 100 = 28 630, contre `CA_COMBINE`).

Pour l'enregistrement, **fusionner les `types_choisis`** des offres cochées et les envoyer au store avec le panier complet du devis. Les catégories qui ne sont dans aucune offre cochée ne partent pas (le store les liste dans `category_ids_non_envoyees`) — à signaler au client avant validation (ex: « Vos Colis Accompagnés ne seront pas envoyés »).

#### Exemple

Panier : 3 kg Huile/Arômes + 3 kg Spécial + 2 kg Colis Accompagnés, Adjamé → Paris.

```json
"offres": [
  {
    "code": "DHD_AERIEN",
    "libelle": "DHD Aérien",
    "montant_total": 16530,
    "expedition": {
      "type_expedition": "groupage_dhd_aerien",
      "category_ids": ["<id huile>", "<id special>"],
      "poids_total": 6,
      "success": true,
      "message": null,
      "montant_base": 14500,
      "montant_prestation": 2030,
      "montant_expedition": 16530,
      "minimum_applique": true,
      "montant_calcule": 12888,
      "detail_categories": [
        { "category_id": "<id huile>", "category_nom": "HUILE, AROME DE JUS, COLAS ET SUCRE", "poids": 3, "prix_unitaire": 1200, "montant": 3888 },
        { "category_id": "<id special>", "category_nom": "SPECIAL(JUS, CUBE MAGGI, VETEMENT)", "poids": 3, "prix_unitaire": 2500, "montant": 9000 }
      ]
    },
    "types_choisis": { "<id huile>": "groupage_dhd_aerien", "<id special>": "groupage_dhd_aerien" },
    "category_ids_non_envoyees": ["<id CA>"],
    "cumulable_avec": ["CA"]
  },
  {
    "code": "CA",
    "libelle": "Colis Accompagnés",
    "montant_total": 12100,
    "expedition": { "type_expedition": "groupage_ca", "poids_total": 2, "montant_expedition": 12100, "...": "..." },
    "types_choisis": { "<id CA>": "groupage_ca" },
    "category_ids_non_envoyees": ["<id huile>", "<id special>"],
    "cumulable_avec": ["DHD_AERIEN"]
  },
  {
    "code": "CA_COMBINE",
    "libelle": "Tout en Colis Accompagnés (tarif combiné)",
    "montant_total": 48400,
    "expedition": { "type_expedition": "groupage_ca", "poids_total": 8, "montant_expedition": 48400, "...": "..." },
    "types_choisis": { "<id huile>": "groupage_ca", "<id special>": "groupage_ca", "<id CA>": "groupage_ca" },
    "category_ids_non_envoyees": [],
    "cumulable_avec": []
  }
]
```

Si le client coche `DHD_AERIEN` + `CA`, envoyer au store :
`"types_choisis": { "<id huile>": "groupage_dhd_aerien", "<id special>": "groupage_dhd_aerien", "<id CA>": "groupage_ca" }`.

| Champ | Description |
|---|---|
| `offres[].code` / `libelle` | Identifiant stable de l'offre / libellé affichable |
| `offres[].montant_total` | Prix de l'offre (= `expedition.montant_expedition`) |
| `offres[].expedition.montant_expedition` | **Prix facturé** (minimum de la ligne inclus si appliqué) |
| `offres[].expedition.montant_avant_promotion` / `montant_remise_promotion` / `promotion` | Présents si une promotion de tarif s'applique (sinon `null` / `0`). `montant_expedition` est **déjà réduit** ; voir `api-promotions-tarifs.md` |
| `offres[].expedition.montant_calcule` | Somme des montants par catégorie, **avant** minimum. Différent de `montant_expedition` seulement si `minimum_applique` est vrai |
| `offres[].expedition.minimum_applique` | Vrai si le total calculé était sous le minimum de la ligne (DHD) et que c'est le minimum qui est facturé |
| `offres[].expedition.detail_categories[]` | Détail par catégorie : `category_nom`, `poids`, `prix_unitaire`, `montant` (vrai montant calculé, sans minimum) |
| `offres[].types_choisis` | Part de `types_choisis` à envoyer au store pour cette offre (à fusionner si plusieurs offres cochées) |
| `offres[].category_ids_non_envoyees` | Catégories du panier que cette offre seule n'envoie pas |
| `offres[].cumulable_avec[]` | Codes des offres que le client peut cocher en même temps que celle-ci |

`offres` peut être un tableau vide (aucun tarif configuré sur la ligne) — ce n'est pas une erreur.

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
- `GET /api/produits` ne filtre pas par éligibilité côté serveur : charger la liste complète du pays **une seule fois**, puis filtrer côté frontend selon le mode actif. En mode LD, ne proposer que les produits avec `eligible_ld === true`. En mode groupage, pas de filtre nécessaire — tous les produits sont sélectionnables, l'éligibilité par type (`eligible_dhd_aerien`/`eligible_dhd_maritime`) est de toute façon revérifiée automatiquement côté serveur au moment du devis (voir le mode groupage plus haut).
- La destination (`destinataire_commune_id`, ou `ville_destination` à défaut) doit être demandée dans le formulaire pour **tous les pays** : sans elle, ni le DHD ni le CA ne peuvent être proposés.
- `ville_depart`/`ville_destination` sont **communs aux deux modes** dans le payload (mêmes noms de champs), mais avec un rôle différent : ignorés par le calcul en mode LD (juste transmis pour préremplir l'étape d'enregistrement ensuite), utilisés en mode groupage pour la ligne DHD — `ville_depart` seulement en repli, `ville_destination` toujours (il n'y a pas d'équivalent "ville de l'agence" côté destinataire). Un même champ de formulaire "ville de départ"/"ville de destination" peut donc être partagé entre les deux écrans sans dupliquer la saisie.
- La catégorie système CA se reconnaît à **`is_default: true`** côté `GET /api/produits`, **jamais à son nom** (il peut être saisi avec une autre casse, ex: `"COLIS ACCOMPAGNÉS"`). Utile pour l'afficher différemment dans l'UI (badge, icône…).

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
