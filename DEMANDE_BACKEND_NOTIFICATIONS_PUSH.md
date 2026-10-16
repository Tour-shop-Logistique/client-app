# Notifications push — ce qu'il faut côté backend pour qu'elles fonctionnent

**Pour :** équipe backend (Laravel) · **Concerne :** app client et app livreur (même mécanisme, mêmes routes)

## Le problème

Quand un utilisateur appuie sur « Activer » les notifications, l'app affiche :

> Les notifications ne sont pas encore disponibles : le serveur n'a pas de clé d'envoi configurée.

L'app appelle `GET /api/push/public-key` et n'y trouve **aucune clé**. Sans cette clé, le navigateur refuse de créer un abonnement push : **aucune notification ne peut partir, quelle que soit la qualité du code de l'app**.

Le contrat actuel (`api-profil-et-notifications-client.md`) prévoit pourtant bien cette route. Il manque très probablement la configuration, pas le code.

---

## 1. À configurer sur le serveur (bloquant)

### Clés VAPID

Le Web Push exige une paire de clés VAPID générée **une seule fois** pour tout le projet.

```bash
# avec le package laravel-notification-channels/webpush
php artisan webpush:vapid

# ou, sans Laravel
npx web-push generate-vapid-keys
```

Dans le `.env` du backend (noms usuels de `laravel-notification-channels/webpush`) :

```env
VAPID_SUBJECT=mailto:contact@tourshop-express.com
VAPID_PUBLIC_KEY=BF3a...clé-publique...
VAPID_PRIVATE_KEY=...clé-privée...
```

Puis vider le cache de configuration :

```bash
php artisan config:clear && php artisan config:cache
```

**Points d'attention**
- La clé **privée ne doit jamais** être exposée (ni dans l'API, ni dans le dépôt).
- **Ne pas régénérer** les clés en production après coup : tous les abonnements déjà enregistrés deviendraient inutilisables (les utilisateurs devraient se réabonner).
- `VAPID_SUBJECT` doit être un `mailto:` ou une URL `https://` valide, sinon certains services push (Apple notamment) rejettent les envois.
- Les mêmes clés servent aux deux apps : une seule paire pour le client et le livreur.

---

## 2. Contrat des routes (déjà documenté — à vérifier)

Routes sous `auth:sanctum`, **tous types d'utilisateurs** (client et livreur).

### `GET /api/push/public-key`

Doit renvoyer la clé **publique** (celle de `VAPID_PUBLIC_KEY`), jamais `null` ni vide :

```json
{ "success": true, "public_key": "BF3a...clé-vapid-publique..." }
```

Le champ doit s'appeler `public_key`, en base64 URL-safe, tel que fourni par `webpush:vapid`.

**Test rapide :** appeler la route avec un token valide ; la réponse doit contenir une chaîne d'environ 87 caractères commençant par `B`.

### `POST /api/push/subscribe`

Corps = l'objet `PushSubscription.toJSON()` du navigateur :

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": { "p256dh": "...", "auth": "..." }
}
```

Réponse `200` : `{ "success": true, "message": "Abonnement enregistré." }`

- Enregistrer (ou mettre à jour si le même `endpoint` existe déjà) **pour l'utilisateur connecté**.
- Un utilisateur peut avoir **plusieurs abonnements** (téléphone + ordinateur).
- Un même `endpoint` ne doit pas rester rattaché à l'ancien compte si quelqu'un se connecte avec un autre compte sur le même appareil.

### `POST /api/push/unsubscribe`

Corps `{ "endpoint": "..." }` → `200` `{ "success": true, "message": "Abonnement supprimé." }`

---

## 3. Format des notifications envoyées

Le service worker de l'app (`public/push-sw.js`) lit ce JSON :

```json
{
  "title": "Colis livré",
  "body": "Votre colis SMXP2026… a été remis au destinataire.",
  "icon": "/icons/icon-192.png",
  "tag": "expedition-<id>",
  "data": { "url": "/expeditions/<id>" },
  "actions": []
}
```

| Champ | Obligatoire | Rôle |
|---|---|---|
| `title` | oui | Titre (par défaut « TourShop ») |
| `body` | oui | Texte |
| `data.url` | recommandé | Page ouverte au toucher de la notification (chemin relatif de l'app) |
| `tag` | non | Remplace une notification précédente de même `tag` (évite l'empilement) |
| `icon`, `actions` | non | Icône, boutons d'action |

Les notifications déjà prévues (voir `NOTIFICATIONS_A_INTEGRER.md`) doivent utiliser ce format : colis livré, demande refusée, abonnement bloqué / paiement validé ou rejeté, annonce masquée, bonus et retraits de parrainage, mission proposée, offre acceptée, etc.

---

## 4. Conditions d'infrastructure

- **HTTPS obligatoire** sur le domaine de l'app et de l'API (le Web Push ne fonctionne pas en HTTP, hors `localhost`).
- **File d'attente :** si les notifications passent par `ShouldQueue`, le worker (`php artisan queue:work`) doit tourner en continu — sinon rien ne part.
- **Nettoyage :** un abonnement expiré renvoie `404`/`410` au moment de l'envoi ; il doit être supprimé de la base (le package le fait via `WebPushChannel` si bien configuré).
- **Réponse CORS :** la route `/api/push/*` doit être couverte par la configuration CORS pour l'origine des deux apps (en production, l'app appelle directement `api.tourshop-express.com`).

---

## 5. Limites connues côté appareils (information)

- **iPhone / iPad :** les notifications push ne fonctionnent que si l'app est **installée sur l'écran d'accueil** (PWA) et sous iOS 16.4 minimum. Dans Safari « simple », le bouton ne peut pas fonctionner.
- **Android (Chrome) :** fonctionne dans le navigateur comme en PWA installée.
- L'utilisateur doit **autoriser** les notifications quand le navigateur le demande ; un refus se change ensuite dans les réglages du site.
- **Nouveau livreur non validé :** il ne peut pas s'abonner avant la validation de son compte (compte inactif, pas de token). Les notifications d'inscription validée ou rejetée passent donc par l'historique serveur (`GET /livreur/notifications`), pas par le push.

---

## 6. Checklist de validation

- [ ] Paire VAPID générée et ajoutée au `.env` du backend (public + private + subject)
- [ ] Cache de config vidé après modification
- [ ] `GET /api/push/public-key` renvoie une vraie clé dans `public_key` (testé avec un token client **et** un token livreur)
- [ ] `POST /api/push/subscribe` enregistre l'abonnement pour l'utilisateur connecté
- [ ] Un envoi de test (ex. `colis_livre`, ou une commande artisan de test) arrive sur un téléphone Android
- [ ] Idem sur iPhone avec l'app installée sur l'écran d'accueil
- [ ] Le worker de queue tourne en production
- [ ] Les abonnements expirés (`404`/`410`) sont supprimés automatiquement

**Une fois la clé en place, aucune modification n'est nécessaire dans les apps** : le bouton « Activer » fonctionnera au prochain essai.

---

## En cas de doute sur la réponse de `GET /api/push/public-key`

Côté app, si la clé est introuvable, la console du navigateur affiche :

```
[push] Réponse de GET /push/public-key sans clé exploitable : { ... }
```

Cette ligne montre exactement ce que le serveur a renvoyé. L'app accepte aussi les noms `publicKey`, `vapid_public_key`, `vapidPublicKey` et `key` (éventuellement sous `data`), mais `public_key` reste le nom attendu par le contrat.
