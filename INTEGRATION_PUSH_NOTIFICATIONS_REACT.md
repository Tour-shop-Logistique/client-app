# Intégration des notifications push — App React (client & livreur)

**Pour :** dev frontend app client / app livreur
**Contexte :** les apps sont en React (même stack que le backoffice et l'agence). Ce guide est calqué exactement sur l'implémentation déjà en place dans ces deux apps.

---

## Vue d'ensemble

Le mécanisme repose sur le **Web Push** standard :

1. L'app enregistre un Service Worker (`sw.js`) dans le navigateur.
2. Le Service Worker souscrit au push via `PushManager`, en utilisant la clé VAPID publique du backend.
3. L'abonnement (endpoint + clés) est envoyé à `POST /api/push/subscribe`.
4. Le backend envoie des notifications via Laravel WebPush — le Service Worker les reçoit et les affiche, même onglet fermé.

---

## 1. Service Worker (`public/sw.js`)

Crée ce fichier à la racine de `public/`. Il doit être servi à l'URL `/sw.js` (pas dans `dist/`, pas dans `src/`).

```js
// Service worker minimal pour les notifications push navigateur (Web Push).
// Ne gère ni cache ni mode hors-ligne — uniquement l'affichage des push et
// le clic dessus (ouvre/focus l'onglet sur l'URL fournie par le backend).

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  const title = payload.title || 'Tour Shop';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/favicon.ico',
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
```

**Points importants :**
- `payload.data.url` = chemin relatif de l'app à ouvrir au tap (ex. `/expeditions/xxx`, `/missions-disponibles`).
- Le fichier doit être accessible à `/sw.js` — configure Vite si nécessaire (voir section 5).

---

## 2. Hook React `usePushNotifications.js`

Copie ce hook dans `src/hooks/` :

```js
import { useCallback, useEffect, useState } from 'react';
import api from '../services/api'; // ton instance axios configurée avec baseURL + token

// Convertit la clé VAPID publique (base64url) au format Uint8Array attendu
// par PushManager.subscribe().
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

const isSupported = () => 'serviceWorker' in navigator && 'PushManager' in window;

export default function usePushNotifications() {
  const [permission, setPermission] = useState(isSupported() ? Notification.permission : 'unsupported');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isSupported()) return;

    navigator.serviceWorker.register('/sw.js').then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    }).catch(() => {});
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported()) return false;
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;

      const registration = await navigator.serviceWorker.ready;
      const { data } = await api.get('/push/public-key');
      const applicationServerKey = urlBase64ToUint8Array(data.public_key);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const json = subscription.toJSON();
      await api.post('/push/subscribe', {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });

      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error('Erreur abonnement push:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!isSupported()) return;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (error) {
      console.error('Erreur désabonnement push:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe, isSupported: isSupported() };
}
```

---

## 3. Composant `PushNotificationPrompt.jsx`

Bannière discrète à placer dans le layout principal (après la connexion). Elle s'affiche une fois par session si l'utilisateur n'a pas encore répondu à la demande de permission.

```jsx
import React, { useState } from 'react';
import { Bell, X } from 'lucide-react';
import usePushNotifications from '../hooks/usePushNotifications';

const PushNotificationPrompt = () => {
  const { permission, isSubscribed, isLoading, subscribe, isSupported } = usePushNotifications();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('push-prompt-dismissed') === '1'
  );

  // N'affiche rien si : non supporté, déjà accordé/refusé, déjà abonné, ou fermé
  if (!isSupported || permission !== 'default' || isSubscribed || dismissed) {
    return null;
  }

  const dismiss = () => {
    sessionStorage.setItem('push-prompt-dismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <Bell size={16} className="text-indigo-600" />
        </div>
        <span className="text-sm font-medium">
          Activez les notifications pour être alerté même quand l'application est fermée.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <button
          onClick={subscribe}
          disabled={isLoading}
          className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          Activer
        </button>
        <button onClick={dismiss} className="p-1.5 text-indigo-400 hover:text-indigo-700 rounded-lg">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PushNotificationPrompt;
```

**Utilisation dans le layout :**

```jsx
// Dans ton layout principal (après auth), juste après le header ou en haut du contenu
import PushNotificationPrompt from '../components/PushNotificationPrompt';

const Layout = ({ children }) => (
  <div>
    <Header />
    <main>
      <PushNotificationPrompt />
      {children}
    </main>
  </div>
);
```

---

## 4. Routes API utilisées

Toutes sous `auth:sanctum` — le token Bearer doit être dans les headers de ton instance axios.

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/push/public-key` | Récupère la clé VAPID publique |
| `POST` | `/api/push/subscribe` | Enregistre l'abonnement push |
| `POST` | `/api/push/unsubscribe` | Supprime l'abonnement |

**Corps de `POST /api/push/subscribe` :**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

**Corps de `POST /api/push/unsubscribe` :**
```json
{ "endpoint": "https://fcm.googleapis.com/fcm/send/..." }
```

---

## 5. Configuration Vite

Pour que `/sw.js` soit servi depuis la racine (pas copié dans `dist/assets/`), deux options :

**Option A — fichier dans `public/` (recommandé)**

Vite copie automatiquement tout le contenu de `public/` à la racine du build. Crée `public/sw.js` : c'est tout.

**Option B — déclarer manuellement dans `vite.config.js`**

```js
// vite.config.js
export default {
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        sw: 'public/sw.js',
      },
    },
  },
};
```

L'option A suffit dans presque tous les cas.

---

## 6. Format des notifications reçues par le Service Worker

Le backend envoie ce JSON dans le payload push :

```json
{
  "title": "Colis livré",
  "body": "Votre colis SMXP2026… a été remis au destinataire.",
  "icon": "/favicon.ico",
  "data": {
    "url": "/expeditions/<id>"
  }
}
```

`data.url` est un chemin relatif de l'app. Le Service Worker ouvre ou focus cet onglet au tap.

---

## 7. Notifications envoyées par le backend

### App client

| Événement | Titre | `data.url` |
|---|---|---|
| Expédition créée / paiement reçu | selon événement | `/expeditions/<id>` |
| Livreur assigné (enlèvement) | "Livreur assigné" | `/expeditions/<id>` |
| Code de livraison à domicile | "Code de livraison" | `/expeditions/<id>` |
| Bonus parrainage reçu | "Bonus parrainage" | `/parrainage` |
| Retrait parrainage validé/rejeté | selon statut | `/parrainage` |

### App livreur

| Événement | Titre | `data.url` |
|---|---|---|
| Mission express disponible | "Nouvelle mission disponible" | `/missions-disponibles` |
| Offre acceptée par le vendeur (marketplace) | "Offre acceptée" | `/missions-marketplace` |
| Retrait validé / rejeté | selon statut | `/solde` |
| Abonnement marketplace bloqué | "Abonnement bloqué" | `/abonnement` |
| Inscription validée / rejetée par le backoffice | selon statut | `/` |

> **Note :** les notifications d'inscription (validée/rejetée) passent par l'historique serveur (`GET /livreur/notifications`) et non par le push, car le compte n'est pas encore actif à ce moment — pas de token disponible pour s'abonner.

---

## 8. Limites connues

| Plateforme | Comportement |
|---|---|
| **Android Chrome** | Fonctionne dans le navigateur et en PWA installée |
| **iPhone / iPad** | Requiert iOS 16.4+ **et** l'app installée sur l'écran d'accueil (PWA). Dans Safari seul, le push ne fonctionne pas |
| **Desktop Chrome / Firefox / Edge** | Fonctionne dans le navigateur |
| **HTTP (non-HTTPS)** | Bloqué par le navigateur sauf sur `localhost` |

---

## 9. Checklist d'intégration

- [ ] `public/sw.js` créé et accessible à `/sw.js` dans le navigateur
- [ ] Hook `usePushNotifications` ajouté dans `src/hooks/`
- [ ] `PushNotificationPrompt` placé dans le layout, visible après connexion
- [ ] Instance axios configurée avec `Authorization: Bearer <token>` (le hook appelle `/push/public-key` et `/push/subscribe`)
- [ ] Tester sur Android Chrome : le bouton "Activer" doit déclencher la demande de permission du navigateur
- [ ] Tester sur iPhone installé en PWA (iOS 16.4+)
- [ ] Vérifier dans la console qu'aucune erreur `DOMException` ne remonte au moment de `PushManager.subscribe()`

---

## 10. Débogage

**La clé VAPID est null (`public_key: null`) :**
Le serveur n'a pas les variables VAPID dans son `.env`. → Problème serveur, non lié à l'app.

**`DOMException: Registration failed - push service error` :**
Le Service Worker est mal enregistré ou l'URL `/sw.js` retourne du HTML (404). Vérifie que `public/sw.js` existe et est accessible.

**`NotAllowedError: The Notification permission was not granted` :**
L'utilisateur a refusé la permission. Il doit aller dans les réglages du site dans son navigateur pour la réactiver — l'app ne peut pas la redemander programmatiquement après un refus.

**Permission accordée mais notification jamais reçue :**
- Vérifier que le worker de queue Laravel tourne sur le serveur (`php artisan queue:work`)
- Vérifier que l'abonnement est bien enregistré en base (`push_subscriptions` sur Supabase)
