# API Authentification Client

Toutes les routes de ce document sont **publiques** (hors `auth:sanctum`) sauf `logout` et `profil`, qui exigent un token.

Flux obligatoire pour un nouveau client : **register → verify-email → login**. `register` et `verify-email` ne retournent jamais de token — `login` est la seule étape qui en délivre un.

---

## `POST /api/register`

### Entrée

```json
{
  "nom": "Kouassi",
  "prenoms": "Jean",
  "telephone": "0102030405",
  "email": "jean.kouassi@example.com",
  "password": "motdepasse123",
  "password_confirmation": "motdepasse123",
  "type": "client"
}
```

| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `nom` | string, max 255 | Oui | |
| `prenoms` | string, max 255 | Non | |
| `telephone` | string | Oui | Unique en base |
| `email` | string, email, max 255 | Oui | Unique en base |
| `password` | string, min 8 | Oui | Doit être accompagné de `password_confirmation` identique |
| `password_confirmation` | string | Oui | Doit être identique à `password` |
| `type` | string | Oui | Toujours `"client"` pour l'app cliente — jamais déduit automatiquement |

### Comportement

- Crée le compte avec `email_verified_at = null`.
- Envoie un **code à 6 chiffres par email** (expire dans 30 minutes).
- **Ne retourne aucun token.** Le compte n'est pas encore utilisable pour se connecter tant que l'email n'est pas vérifié.

### Sortie — succès (201)

```json
{
  "success": true,
  "message": "Inscription réussie. Un code de vérification a été envoyé à votre adresse email.",
  "user": {
    "id": "uuid",
    "nom": "Kouassi",
    "prenoms": "Jean",
    "telephone": "0102030405",
    "email": "jean.kouassi@example.com",
    "type": "client",
    "email_verified_at": null,
    "actif": true,
    "...": "..."
  }
}
```

### Erreurs

**Email ou téléphone déjà utilisé (422)**
```json
{
  "success": false,
  "message": "Un compte avec cet email ou ce téléphone existe déjà.",
  "errors": {
    "email": ["Cet email est déjà utilisé."],
    "telephone": ["Ce téléphone est déjà utilisé."]
  }
}
```

**Validation (422)**
```json
{ "success": false, "message": "Erreur de validation des données.", "errors": { "password": ["The password confirmation does not match."] } }
```

---

## `POST /api/verify-email`

### Entrée

```json
{ "email": "jean.kouassi@example.com", "code": "482913" }
```

| Champ | Type | Obligatoire |
|---|---|---|
| `email` | string, email | Oui |
| `code` | string, exactement 6 caractères | Oui |

### Comportement

- Vérifie le code (haché en base, expiré après 30 minutes depuis `register`/`resend`).
- Si valide : renseigne `email_verified_at = now()` sur le compte. **C'est cette étape qui débloque `login`.**
- Aucun token retourné — il faut appeler `login` ensuite.

### Sortie — succès (200)

```json
{ "success": true, "message": "Adresse email vérifiée avec succès. Vous pouvez maintenant vous connecter." }
```

### Erreurs

```json
{ "success": false, "message": "Code invalide ou expiré." }
```
```json
{ "success": false, "message": "Utilisateur introuvable." }
```
(HTTP 422 et 404 respectivement)

---

## `POST /api/resend-email-verification`

À utiliser si le code a expiré ou n'est jamais arrivé.

### Entrée

```json
{ "email": "jean.kouassi@example.com" }
```

### Sortie — toujours `success: true` en cas normal (200)

```json
{ "success": true, "message": "Si cet e-mail est associé à un compte non vérifié, un nouveau code a été envoyé." }
```

> Message volontairement générique si l'email n'existe pas (anti-énumération de comptes). Si le compte est déjà vérifié :

```json
{ "success": true, "message": "Cette adresse email est déjà vérifiée." }
```

---

## `POST /api/login`

### Entrée

```json
{
  "email": "jean.kouassi@example.com",
  "password": "motdepasse123",
  "type": "client"
}
```

| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `email` | string, email | Un des deux (`email` ou `telephone`) requis | |
| `telephone` | string | Un des deux (`email` ou `telephone`) requis | |
| `password` | string | Oui | |
| `type` | string | Oui | Toujours `"client"` — sert de filtre, un compte agence avec le même email ne matchera pas |

### Comportement

Bloque avec 422 dans ces cas, avant même de vérifier le mot de passe :
- Aucun utilisateur avec ce téléphone/email + ce type → `"Les identifiants fournis sont incorrects."`
- Compte désactivé (`actif = false`) → `"Votre compte est désactivé."`
- **Email non vérifié** → `"Veuillez vérifier votre adresse email avant de vous connecter."`

### Sortie — succès (200)

```json
{
  "success": true,
  "message": "Connexion réussie",
  "user": { "id": "uuid", "nom": "Kouassi", "type": "client", "...": "..." },
  "token": "12|AbCdEf1234567890..."
}
```

Le champ s'appelle **`token`** (pas `access_token`). C'est un token Sanctum classique — à envoyer ensuite dans le header `Authorization: Bearer <token>` sur toutes les routes protégées (`expedition/client/store`, `list`, `show`, `cancel`, `statistics`, `logout`, `profil`, etc.).

### Erreurs (422)

```json
{ "success": false, "message": "Erreur de validation des identifiants.", "errors": { "email": ["Veuillez vérifier votre adresse email avant de vous connecter."] } }
```

---

## `POST /api/logout`

**Authentification requise.**

Révoque uniquement le token utilisé pour cet appel (pas les autres sessions/appareils éventuellement connectés).

### Sortie — succès (200)

```json
{ "success": true, "message": "Déconnexion réussie." }
```

---

## `GET /api/profil`

**Authentification requise.**

Retourne les infos du compte actuellement connecté (utile pour restaurer une session au démarrage de l'app à partir d'un token stocké).

### Sortie — succès (200)

```json
{ "success": true, "user": { "id": "uuid", "nom": "Kouassi", "type": "client", "role_details": null, "...": "..." } }
```

---

## Mot de passe oublié — 3 étapes

### 1. `POST /api/forgot-password`

```json
{ "email": "jean.kouassi@example.com" }
```

Envoie un code à 6 chiffres par email (expire dans 15 minutes).

**Sortie — succès (200)**
```json
{ "success": true, "message": "Un code de réinitialisation a été envoyé à votre adresse e-mail." }
```

**Sortie — email inconnu — attention, HTTP 200 avec `success: false` (pas 404)**
```json
{ "success": false, "message": "Aucun compte trouvé avec cette adresse e-mail." }
```
Toujours lire le flag `success`, pas seulement le code HTTP, pour ce endpoint.

### 2. `POST /api/verify-reset-code`

```json
{ "email": "jean.kouassi@example.com", "code": "738291" }
```

Vérifie le code sans le consommer (permet d'afficher l'écran "nouveau mot de passe" seulement si le code est valide).

**Sortie — succès (200)**
```json
{ "success": true, "message": "Code validé. Vous pouvez définir un nouveau mot de passe." }
```

**Sortie — code invalide/expiré (422)**
```json
{ "success": false, "message": "Code invalide ou expiré." }
```

### 3. `POST /api/reset-password`

```json
{
  "email": "jean.kouassi@example.com",
  "code": "738291",
  "password": "nouveaumotdepasse123",
  "password_confirmation": "nouveaumotdepasse123"
}
```

Change le mot de passe et **révoque tous les tokens existants** du compte (déconnexion forcée de toutes les sessions/appareils). Reconnexion via `login` obligatoire après.

**Sortie — succès (200)**
```json
{ "success": true, "message": "Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter." }
```

---

## Points d'attention pour l'implémentation frontend

- **Aucune vérification par téléphone/WhatsApp/OTP n'est implémentée côté backend actuellement**, malgré la colonne `telephone_verified_at` prévue en base et malgré le cahier des charges qui évoque une vérification WhatsApp. Seule la vérification par email existe et est bloquante aujourd'hui. Si le design de l'app PWA prévoit un flux WhatsApp/SMS, il faudra le construire séparément — ne pas s'appuyer dessus pour l'instant.
- `type: "client"` doit être envoyé explicitement à **chaque** appel de `register` et `login` — ce n'est jamais déduit du contexte ou de la route appelée.
- Stocker le `token` reçu à la connexion (ex: `localStorage`/`sessionStorage` selon la stratégie PWA) et l'envoyer en `Authorization: Bearer <token>` sur toutes les routes authentifiées listées dans `docs/api-enregistrement-expedition-client.md`.
- Après un `reset-password`, l'ancien token stocké côté client devient invalide (tous révoqués) — il faut détecter une réponse 401 et rediriger vers `login`, ou explicitement invalider le token stocké côté client juste après l'appel `reset-password`.
- Le flux complet minimal pour un nouveau client : `register` → écran "saisir le code reçu par email" → `verify-email` → `login` automatique ou redirection vers l'écran de connexion.

---

## Endpoints associés (rappel)

| Endpoint | Auth | Usage |
|---|---|---|
| `POST /api/register` | Non | Inscription |
| `POST /api/verify-email` | Non | Vérification du code email |
| `POST /api/resend-email-verification` | Non | Renvoi du code email |
| `POST /api/login` | Non | Connexion — retourne le token |
| `POST /api/logout` | Oui | Déconnexion (token courant uniquement) |
| `GET /api/profil` | Oui | Infos du compte connecté |
| `POST /api/forgot-password` | Non | Demande de réinitialisation |
| `POST /api/verify-reset-code` | Non | Vérification du code de réinitialisation |
| `POST /api/reset-password` | Non | Nouveau mot de passe (révoque tous les tokens) |
