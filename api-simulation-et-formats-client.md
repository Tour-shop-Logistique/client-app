# API Simulation Interville et Formats de Colis Client

Trois endpoints qui complètent `docs/api-devis-client.md` :

- `GET /api/communes` : liste publique des communes d'un pays — **à appeler en premier** pour obtenir le `destinataire_commune_id` nécessaire à `simulate-interville` ci-dessous.
- `POST /api/expedition/client/simulate-interville` : **seul moyen de simuler une expédition Interville** (transport entre deux communes du même pays) côté client — `devis` (public, sans token) ne couvre que LD et Groupage international. Techniquement générique (accepte n'importe quel `type_expedition`, pas seulement `interville`), mais réservez son usage à l'Interville : pour LD/Groupage, `devis` reste préférable (public, routage géographique automatique).
- `GET /api/expedition/client/formats-colis` : liste les formats de colis (Petit/Moyen/Grand, extensibles par backoffice) pour construire un sélecteur visuel — pertinent notamment pour l'Interville, où le client choisit librement son format (contrairement à l'agence, où il est déduit automatiquement du poids/volume).

---

## `GET /api/communes`

**Authentification** : aucune (route publique, hors `auth:sanctum`) — accessible qu'on soit connecté ou non, sans restriction de profil (même principe que `GET /api/agences` et `GET /api/produits`).

### Paramètres (query string)

| Paramètre | Type | Obligatoire | Notes |
|---|---|---|---|
| `code_pays` | string (code ISO pays, ex. `CI`) | Oui | Résout le backoffice du pays ; insensible à la casse |

```
GET /api/communes?code_pays=CI
```

### Sortie — succès (200)

```json
{
  "success": true,
  "communes": [
    { "id": "uuid-abidjan", "nom": "Abidjan" },
    { "id": "uuid-bouake", "nom": "Bouaké" }
  ]
}
```

Triées par nom, uniquement les communes actives (`actif: true`) du backoffice résolu — jamais les communes des autres pays. Champs volontairement réduits à `id`/`nom` (liste destinée à un simple sélecteur, pas à un usage de gestion).

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

## `POST /api/expedition/client/simulate-interville`

**Authentification** : requise (`auth:sanctum`), contrairement à `POST /api/expedition/client/devis` qui est public. Réservé aux comptes `client`.

### Pourquoi cet endpoint, en plus de `devis`

`devis` ne gère que LD et Groupage international (routage automatique selon le pays de destination) — il n'a pas de notion de commune ni d'Interville. `simulate-interville` est l'unique endpoint qui permet de simuler ce type précis avant de l'enregistrer via `store`. Le nom de la route reflète cet usage principal ; en pratique, ne l'appelez qu'avec `type_expedition: "interville"`.

### Entrée

```json
{
  "agence_id": "d60b5ab0-f928-4bd7-a4ed-e7e8123b6b37",
  "type_expedition": "interville",
  "destinataire_commune_id": "uuid-commune-yamoussoukro",
  "colis": [
    { "poids": 5, "longueur": 40, "largeur": 30, "hauteur": 20, "format_colis_id": "uuid-format-moyen" }
  ]
}
```

| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `agence_id` | uuid | Oui | Agence de départ, doit être active. **N'a d'incidence sur le tarif que de façon indirecte** — l'agence ne porte aucune commission ni majoration propre à elle pour l'Interville ; elle sert uniquement à déterminer (a) la **commune de départ** (`agence.commune_id`, jamais saisie par le client) et (b) le **backoffice** dont dépend la grille de tarifs. Le montant lui-même vient exclusivement de `tarifs_interville`, défini par le backoffice pour la paire de communes + le format choisi — les agences n'ont aucun moyen de modifier ces tarifs. |
| `type_expedition` | string | Oui | `"interville"` pour cet usage |
| `destinataire_commune_id` | uuid | **Oui pour l'Interville** (`required_if:type_expedition,interville`) | La commune d'arrivée — pas une ville en texte libre. Sans elle : `"Commune de destination requise pour la simulation interville."` |
| `expediteur_ville` / `destinataire_ville` | string | Non | Sans effet pour l'Interville (la commune de départ vient de l'agence ; la commune d'arrivée vient de `destinataire_commune_id`, pas d'une ville texte) |
| `colis[]` | array, min 1 | Oui | |
| `colis[].poids` | number | Oui, min 0 | kg |
| `colis[].longueur/largeur/hauteur` | number | Non | cm |
| `colis[].format_colis_id` | uuid | Non | Voir `GET /api/expedition/client/formats-colis` ci-dessous — si omis, le format par défaut du backoffice est utilisé |
| `colis[].prix_emballage` | number | Non | |
| `colis[].category_id` / `colis[].code_colis` | — | Non | Sans usage pour l'Interville (pertinents seulement pour les autres types d'expédition, que cet endpoint ne devrait pas servir à simuler — voir `devis`) |

**Champs de validation génériques hérités de l'endpoint** (à ignorer pour l'Interville, mais requis par la règle `required_unless:type_expedition,interville`) : `zone_depart_id`, `zone_destination_id` — pertinents uniquement pour les autres types (`simulerTarifSimple`), sans effet sur le calcul Interville. Ne les envoyez pas si `type_expedition: "interville"`, la validation les ignore alors.

### Sortie — succès (200)

```json
{
  "success": true,
  "message": "Tarification simulée avec succès",
  "data": {
    "success": true,
    "tarif": {
      "montant_base": 3000,
      "pourcentage_prestation": 20,
      "montant_prestation": 600,
      "montant_expedition": 3600
    },
    "colis": [
      {
        "category_id": null,
        "format_colis_id": "uuid-format-moyen",
        "poids": 5,
        "longueur": 40,
        "largeur": 30,
        "hauteur": 20,
        "volume": 24000,
        "prix_unitaire": 3000,
        "montant_colis_base": 3000,
        "pourcentage_prestation": 20,
        "montant_colis_prestation": 600,
        "montant_colis_total": 3600
      }
    ]
  }
}
```

Le résultat est doublement enveloppé (`data.success`/`data.tarif`/`data.colis`, en plus du `success` de premier niveau, qui vaut toujours `true` ici) — c'est le format brut du service de tarification interne, retourné tel quel dans `data` uniquement en cas de succès. **La forme de `data` pour l'Interville diffère de celle de LD/Groupage** (voir `docs/api-devis-client.md`) : `pourcentage_prestation` au niveau global, et le détail par colis dans `data.colis` (pas `data.tarif.details_colis`).

### Erreurs (422)

Contrairement au succès, un échec du calcul renvoie directement `success: false` au premier niveau (pas de `data` imbriqué) :

**Agence invalide/inactive**
```json
{ "success": false, "message": "Agence invalide ou inactive" }
```

**Commune de destination manquante**
```json
{ "success": false, "message": "Commune de destination requise pour la simulation interville." }
```
Se produit si `destinataire_commune_id` est absent (obligatoire dès que `type_expedition: "interville"`).

**Agence sans commune configurée**
```json
{ "success": false, "message": "Aucune commune n'est associée à votre agence." }
```
Problème de configuration côté backoffice/agence, rien à corriger côté app cliente.

**Aucun tarif configuré entre les deux communes pour ce format**
```json
{ "success": false, "message": "Aucun tarif interville configuré entre ces deux communes pour le format Moyen." }
```

**Autres cas (zone introuvable, type non pris en charge, etc.)**
```json
{ "success": false, "message": "..." }
```
Message exact variable selon la cause — toujours afficher `message` tel quel, pas de code d'erreur structuré à mapper.

---

## `GET /api/expedition/client/formats-colis`

**Authentification** : requise (`auth:sanctum`).

Liste les formats de colis (Petit/Moyen/Grand par défaut, extensibles) du **backoffice du client**, résolu automatiquement via `User.code_pays` — pas de paramètre à envoyer, pas d'`agence_id` (un client n'a pas d'agence fixe).

### Sortie — succès (200)

```json
{
  "success": true,
  "formats": [
    { "id": "uuid-petit", "backoffice_id": "uuid-backoffice", "nom": "Petit", "ordre": 1, "poids_max": 5, "longueur_max": 30, "largeur_max": 20, "hauteur_max": 20, "volume_max": 12000, "is_default": false },
    { "id": "uuid-moyen", "backoffice_id": "uuid-backoffice", "nom": "Moyen", "ordre": 2, "poids_max": 15, "longueur_max": 50, "largeur_max": 40, "hauteur_max": 40, "volume_max": 80000, "is_default": true },
    { "id": "uuid-grand", "backoffice_id": "uuid-backoffice", "nom": "Grand", "ordre": 3, "poids_max": null, "longueur_max": null, "largeur_max": null, "hauteur_max": null, "volume_max": null, "is_default": false }
  ]
}
```

Triés par `ordre` croissant (du plus petit au plus grand). `poids_max`/dimensions `null` = illimité (typiquement le dernier format de la liste). `is_default: true` sur un seul format — celui utilisé si le client n'en choisit pas explicitement.

### Erreurs

**Pas de pays associé au compte (422)**
```json
{ "success": false, "message": "Aucun pays n'est associé à votre compte." }
```
Ne devrait normalement jamais arriver pour un client (voir `docs/api-authentification-client.md` — `code_pays` obligatoire à l'inscription), mais reste possible sur un compte créé avant l'ajout de cette contrainte.

**Backoffice introuvable pour ce pays (404)**
```json
{ "success": false, "message": "Backoffice introuvable pour votre pays." }
```

---

## Endpoints associés (rappel)

| Endpoint | Auth | Méthode | Usage |
|---|---|---|---|
| `/api/communes` | Non | GET | Liste publique des communes d'un pays (`?code_pays=`) |
| `/api/expedition/client/simulate-interville` | Oui (client) | POST | Simulation de tarif Interville |
| `/api/expedition/client/formats-colis` | Oui (client) | GET | Liste des formats de colis du backoffice du client |
