# API Profil et Notifications Client

Toutes les routes de ce document exigent un token (`Authorization: Bearer <token>`).

Ne pas confondre avec `GET /api/profil` (`docs/api-authentification-client.md`) — c'est un endpoint distinct et redondant en lecture (`GET /api/profile/` ci-dessous renvoie exactement le même format), gardé pour compatibilité historique. Les endpoints de **modification** du profil (`update`, `change-password`, `favorite-addresses`, `avatar`, `delete-account`) n'existent que sous le préfixe `/api/profile/*`.

---

## `GET /api/profile/`

Identique à `GET /api/profil` — retourne le compte actuellement connecté.

### Sortie — succès (200)

```json
{ "success": true, "user": { "id": "uuid", "nom": "Kouassi", "type": "client", "role_details": null, "...": "..." } }
```

---

## `PUT /api/profile/update`

Met à jour les informations personnelles. Tous les champs sont optionnels (`sometimes`) — n'envoyer que ceux à modifier.

### Entrée

```json
{ "nom": "Kouassi", "prenoms": "Jean-Pierre", "telephone": "0102030406", "email": "nouveau@example.com", "code_pays": "FR" }
```

| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `nom` | string, max 255 | Non | |
| `prenoms` | string, max 255, nullable | Non | |
| `telephone` | string | Non | Unique en base (hors le compte courant) |
| `email` | string, email, max 255, nullable | Non | Unique en base (hors le compte courant) |
| `code_pays` | string (code ISO pays, ex. `FR`) | Non | **Uniquement pour un compte `client`** — `422` (`"The code pays field is prohibited."`) si envoyé par un compte agence/livreur/backoffice, qui dérivent leur pays de leur entité propre. Même validation `ValidCountryCode` qu'à l'inscription (voir `docs/api-authentification-client.md`), insensible à la casse (`"fr"` stocké comme `"FR"`). |

### Comportement — cas particulier de l'email

Si `email` est envoyé et **diffère** de l'email actuel :
- `email_verified_at` repasse à `null` immédiatement (le compte reste connecté avec le token actuel, mais `login` sera ensuite bloqué tant que la nouvelle adresse n'est pas revérifiée — voir `docs/api-authentification-client.md`).
- Un nouveau code à 6 chiffres est envoyé à la **nouvelle** adresse (même mécanisme que l'inscription, `POST /api/verify-email` à rappeler avec la nouvelle adresse).

Si `email` est absent, ou identique à l'actuel, rien de spécial — mise à jour normale.

### Comportement — changement de `code_pays`

Change immédiatement le rattachement du client à son backoffice (tarification, formats de colis via `GET /api/expedition/client/formats-colis`, parrainage — taux national/international appliqués selon le pays au moment de chaque activité, pas au moment de l'inscription). Aucune re-vérification requise (contrairement à l'email) — effectif dès la réponse.

### Sortie — succès (200)

```json
{
  "success": true,
  "message": "Profil mis à jour avec succès. Un code de vérification a été envoyé à votre nouvelle adresse email.",
  "user": { "id": "uuid", "nom": "Kouassi", "email": "nouveau@example.com", "email_verified_at": null, "code_pays": "FR", "...": "..." }
}
```

Le message n'a la phrase sur le code de vérification que si l'email a effectivement changé — sinon juste `"Profil mis à jour avec succès."`.

### Erreurs (422)

```json
{ "success": false, "message": "Erreur de validation des données.", "errors": { "telephone": ["The telephone has already been taken."] } }
```

```json
{ "success": false, "message": "Erreur de validation des données.", "errors": { "code_pays": ["Le champ code_pays doit être un code pays ISO valide (ex: CI, FR)."] } }
```

**Compte non-client tentant de changer `code_pays` (422)**
```json
{ "success": false, "message": "Erreur de validation des données.", "errors": { "code_pays": ["The code pays field is prohibited."] } }
```

---

## `PUT /api/profile/change-password`

### Entrée

```json
{ "current_password": "ancienmotdepasse", "password": "nouveaumotdepasse123", "password_confirmation": "nouveaumotdepasse123" }
```

| Champ | Type | Obligatoire |
|---|---|---|
| `current_password` | string | Oui |
| `password` | string, min 8 | Oui — avec `password_confirmation` identique |

### Comportement

Vérifie `current_password` avant tout. Si correct, change le mot de passe **et révoque tous les tokens du compte** (comme `reset-password` — déconnexion forcée, reconnexion via `login` obligatoire ensuite avec le nouveau mot de passe).

### Sortie — succès (200)

```json
{ "success": true, "message": "Mot de passe changé avec succès. Veuillez vous reconnecter." }
```

### Erreurs (422)

```json
{ "success": false, "message": "Erreur de validation des données.", "errors": { "current_password": ["L'ancien mot de passe est incorrect."] } }
```

---

## `PUT /api/profile/favorite-addresses`

Remplace **entièrement** la liste des adresses favorites du compte (pas d'ajout/suppression individuelle — toujours envoyer le tableau complet souhaité).

### Entrée

```json
{
  "adresses_favoris": [
    { "nom": "Domicile", "adresse": "Rue des Jardins, Cocody", "ville": "Abidjan", "code_postal": null, "pays": "Côte d'Ivoire" },
    { "nom": "Bureau", "adresse": "Plateau, Immeuble X", "ville": "Abidjan", "code_postal": null, "pays": "Côte d'Ivoire" }
  ]
}
```

| Champ | Type | Obligatoire |
|---|---|---|
| `adresses_favoris` | array | Oui |
| `adresses_favoris[].nom` | string | Oui |
| `adresses_favoris[].adresse` | string | Oui |
| `adresses_favoris[].ville` | string, nullable | Non |
| `adresses_favoris[].code_postal` | string, nullable | Non |
| `adresses_favoris[].pays` | string, nullable | Non |

Stocké tel quel en JSON (colonne `adresses_favoris`, cast `array`) — aucune validation de cohérence géographique, aucun lien avec les zones/communes de tarification. Purement un carnet d'adresses pour préremplir un formulaire d'expédition côté app, pas une donnée utilisée par le calcul de tarif.

### Sortie — succès (200)

```json
{
  "success": true,
  "message": "Adresses favoris mises à jour avec succès.",
  "adresses_favoris": [ "...(le tableau tel qu'envoyé, retourné en confirmation)..." ]
}
```

Pour supprimer toutes les adresses, envoyer `"adresses_favoris": []` (le champ reste requis, mais peut être un tableau vide).

---

## `PUT /api/profile/avatar`

### Entrée

```json
{ "avatar": "https://.../mon-avatar.jpg" }
```

| Champ | Type | Obligatoire |
|---|---|---|
| `avatar` | string | Oui |

**Ce n'est pas un endpoint d'upload de fichier** — `avatar` est une simple string stockée telle quelle (pas de cast, pas de validation d'URL ni de traitement d'image côté serveur). Il n'existe actuellement aucun endpoint d'upload d'image dans l'API pour ce champ : l'app cliente doit héberger l'image ailleurs (service tiers, ou un futur endpoint à construire) et n'envoyer ici que l'URL résultante.

### Sortie — succès (200)

```json
{ "success": true, "message": "Avatar mis à jour avec succès.", "avatar": "https://.../mon-avatar.jpg" }
```

---

## `PUT /api/profile/availability`

Bascule la disponibilité du compte (`User.disponible`). **Pensé pour les livreurs** (utilisé pour filtrer les livreurs assignables — voir `User::scopeDisponibles()`), mais l'endpoint ne vérifie pas le type de compte : techniquement appelable par un client, sans effet pratique connu côté client actuellement.

### Entrée

```json
{ "disponible": false }
```

### Sortie — succès (200)

```json
{ "success": true, "message": "Vous êtes maintenant indisponible.", "disponible": false }
```

---

## `DELETE /api/profile/delete-account`

Soft delete : ne supprime aucune ligne, marque `is_deleted = true` **et** `actif = false`.

### Entrée

```json
{ "password": "motdepasse" }
```

| Champ | Type | Obligatoire |
|---|---|---|
| `password` | string | Oui — vérifié avant toute suppression |

### Comportement

- Vérifie le mot de passe.
- **Bloque** (422, sans rien supprimer) si le compte est l'administrateur créateur d'une agence ou d'un backoffice (`agence.user_id === user.id` ou `backoffice.user_id === user.id`) — n'affecte jamais un compte client normal, uniquement pertinent pour les comptes agence/backoffice.
- Révoque tous les tokens du compte.
- Après suppression, `login` renverra `"Votre compte est désactivé."` (même message que pour une simple désactivation manuelle par un backoffice — pas de message distinct "compte supprimé", car le check de connexion ne teste que `actif`, pas `is_deleted`).

### Sortie — succès (200)

```json
{ "success": true, "message": "Compte supprimé avec succès." }
```

### Erreurs

**Mot de passe incorrect (422)**
```json
{ "success": false, "message": "Erreur de validation des données.", "errors": { "password": ["Le mot de passe est incorrect."] } }
```

**Compte protégé — non applicable à un client (422)**
```json
{ "success": false, "message": "Impossible de supprimer le compte de l'administrateur créateur de l'agence." }
```

---

## Notifications push (Web Push standard)

Basé sur l'API navigateur `PushManager`/`PushSubscription` (VAPID) — pensé pour une **PWA**, pas pour une app mobile native avec FCM/APNs. Si l'app cliente est une app mobile native, ces endpoints ne sont probablement pas ceux à utiliser (à clarifier avec l'équipe backend si c'est le cas — aucun endpoint FCM/APNs n'existe actuellement).

### `GET /api/push/public-key`

Retourne la clé publique VAPID à utiliser côté client pour créer l'abonnement (`PushManager.subscribe({ applicationServerKey: ... })`).

**Sortie — succès (200)**
```json
{ "success": true, "public_key": "BF3a...clé-vapid-publique..." }
```

### `POST /api/push/subscribe`

Enregistre (ou met à jour, si le même `endpoint` existe déjà) l'abonnement du navigateur courant. Correspond directement à l'objet `PushSubscription.toJSON()` du navigateur.

**Entrée**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": { "p256dh": "...", "auth": "..." }
}
```

**Sortie — succès (200)**
```json
{ "success": true, "message": "Abonnement enregistré." }
```

### `POST /api/push/unsubscribe`

**Entrée**
```json
{ "endpoint": "https://fcm.googleapis.com/fcm/send/..." }
```

**Sortie — succès (200)**
```json
{ "success": true, "message": "Abonnement supprimé." }
```

---

## Endpoints associés (rappel)

| Endpoint | Méthode | Usage |
|---|---|---|
| `/api/profile/` | GET | Profil complet (identique à `/api/profil`) |
| `/api/profile/update` | PUT | Modifier nom/prénoms/téléphone/email |
| `/api/profile/change-password` | PUT | Changer le mot de passe (révoque tous les tokens) |
| `/api/profile/favorite-addresses` | PUT | Remplacer la liste d'adresses favorites |
| `/api/profile/avatar` | PUT | Mettre à jour l'URL de l'avatar (pas d'upload) |
| `/api/profile/availability` | PUT | Bascule disponibilité (pertinent livreur, pas client) |
| `/api/profile/delete-account` | DELETE | Suppression (soft delete) du compte |
| `/api/push/public-key` | GET | Clé VAPID publique |
| `/api/push/subscribe` | POST | Enregistrer un abonnement Web Push |
| `/api/push/unsubscribe` | POST | Supprimer un abonnement Web Push |
