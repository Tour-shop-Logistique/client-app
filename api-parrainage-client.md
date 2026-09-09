# API Parrainage Client

Toutes les routes de ce document exigent un token (`Authorization: Bearer <token>`) et sont réservées aux comptes de type `client` (403 sinon). Lecture seule dans ce premier périmètre — **pas d'endpoint de retrait du solde** (mécanisme pas encore précisé côté produit).

Le code de parrainage lui-même (`code_parrainage`) est généré automatiquement à la création du compte et déjà disponible dans la réponse de `POST /api/register`, `POST /api/login` et `GET /api/profil` (voir `docs/api-authentification-client.md`) — les endpoints ci-dessous servent à consulter le **résultat** du parrainage (solde, historique, filleuls), pas juste le code.

---

## `GET /api/client/parrainage/mon-code`

Retourne le code de parrainage du compte connecté. Redondant avec le champ `code_parrainage` déjà présent dans `user` sur `register`/`login`/`profil` — utile si l'app a besoin de le relire isolément sans recharger tout le profil (ex: écran "Parrainer un ami" dédié).

### Sortie — succès (200)

```json
{ "success": true, "code_parrainage": "BYNHH23T" }
```

---

## `GET /api/client/parrainage/solde`

Solde cumulé des bonus de parrainage crédités au compte connecté (montant disponible, en FCFA — pas de champ `devise`, toujours dans la devise du backoffice du pays du client).

### Sortie — succès (200)

```json
{ "success": true, "solde_parrainage": 750.0 }
```

`0` (pas `null`) si aucun bonus n'a encore été crédité — la colonne a un défaut à `0` en base.

---

## `GET /api/client/parrainage/historique`

Journal des bonus effectivement crédités au compte connecté (un bonus = une activité payante d'un filleul qui a déclenché un crédit — voir plus bas). Paginé (20 par page, page Laravel standard via `?page=N`), du plus récent au plus ancien.

### Sortie — succès (200)

```json
{
  "success": true,
  "historique": {
    "current_page": 1,
    "data": [
      {
        "id": "uuid-bonus",
        "parrain_id": "uuid-parrain",
        "filleul_id": "uuid-filleul",
        "type_evenement": "expedition_internationale",
        "expedition_id": "uuid-expedition",
        "mission_id": null,
        "montant_base": 15000.0,
        "taux_applique": 5.0,
        "montant_bonus": 750.0,
        "created_at": "2026-09-01T10:15:00.000000Z",
        "updated_at": "2026-09-01T10:15:00.000000Z",
        "filleul": { "id": "uuid-filleul", "nom": "Yao", "prenoms": "Marie" }
      }
    ],
    "first_page_url": "...",
    "last_page": 1,
    "per_page": 20,
    "total": 1
  }
}
```

C'est la structure de pagination Laravel brute (`->paginate()->toJson()`), pas un format `meta`/`pagination` custom — attention si le reste de l'app utilise un autre format de pagination ailleurs.

| Champ | Notes |
|---|---|
| `type_evenement` | `expedition_internationale` \| `expedition_nationale` (Interville) \| `enlevement_livraison` — jamais `marketplace` actuellement (taux configuré côté backoffice mais le déclenchement n'est pas construit, le système marketplace articles/fournisseurs n'existe pas encore) |
| `expedition_id` / `mission_id` | Exactement un des deux est renseigné selon `type_evenement` (jamais les deux, jamais aucun) |
| `montant_base` | Montant de l'activité du filleul sur laquelle le taux a été appliqué (montant agence de départ pour une expédition, montant final pour une mission d'enlèvement/livraison) |
| `taux_applique` | Le taux effectivement appliqué au moment du crédit (%), pas forcément le taux actuel du backoffice si celui-ci a changé depuis |
| `montant_bonus` | `montant_base * taux_applique / 100`, arrondi à 2 décimales |
| `filleul` | Toujours chargé (`with('filleul:id,nom,prenoms')`), jamais `null` |

### Sortie — vide (200)

```json
{ "success": true, "historique": { "current_page": 1, "data": [], "total": 0, "..." : "..." } }
```

Pas d'erreur 404 pour un historique vide — toujours 200 avec `data: []`.

---

## `GET /api/client/parrainage/filleuls`

Liste des comptes clients directement parrainés par le compte connecté (ceux qui ont saisi son `code_parrainage` à l'inscription). Non paginé, non filtré par statut.

### Sortie — succès (200)

```json
{
  "success": true,
  "filleuls": [
    { "id": "uuid-filleul", "nom": "Yao", "prenoms": "Marie", "created_at": "2026-08-15T09:00:00.000000Z" }
  ]
}
```

Un filleul apparaît ici dès son inscription, **même s'il n'a encore réalisé aucune activité payante** (donc même sans ligne correspondante dans `historique`) — cette liste ne reflète que le lien de parrainage (`User.parrain_id`), pas les bonus effectivement crédités.

### Sortie — aucun filleul (200)

```json
{ "success": true, "filleuls": [] }
```

---

## Erreur commune aux 4 endpoints

**Compte non-client (403)**

```json
{ "success": false, "message": "Non autorisé" }
```

Se produit si le token appartient à un compte `agence`/`livreur`/`backoffice` — ces routes ne sont pertinentes que pour l'app client, mais restent techniquement accessibles avec n'importe quel token valide (le contrôle de type se fait dans le contrôleur, pas dans le middleware de route).

---

## Comment un bonus est effectivement crédité (contexte, rien à appeler côté client)

Le crédit **ne se produit jamais à l'inscription** avec un code parrain — seulement plus tard, quand le filleul réalise une activité payante :

- Expédition internationale ou nationale (Interville) **intégralement payée** → bonus au parrain selon le taux `taux_international`/`taux_national` du backoffice concerné.
- Enlèvement ou livraison à domicile **payé** → bonus selon `taux_enlevement`.

Le taux appliqué est celui du **backoffice de l'agence de départ** de l'activité (pas celui du parrain ni du filleul, qui peuvent être dans un autre pays). Le crédit est automatique côté serveur (déclenché par les endpoints de paiement d'expédition/mission, pas par un appel dédié) et idempotent — un même événement ne peut jamais créditer deux fois. Rien à implémenter côté app client sur ce point : `historique`/`solde` se mettent simplement à jour tout seuls après coup, à rafraîchir en pull (pas de notification push dédiée sur un nouveau bonus actuellement).

---

## Endpoints associés (rappel)

| Endpoint | Auth | Usage |
|---|---|---|
| `GET /api/client/parrainage/mon-code` | Oui | Code de parrainage du compte connecté |
| `GET /api/client/parrainage/solde` | Oui | Solde cumulé des bonus |
| `GET /api/client/parrainage/historique` | Oui | Journal paginé des bonus crédités |
| `GET /api/client/parrainage/filleuls` | Oui | Liste des clients parrainés (lien seul, pas les bonus) |
