/* global self, clients */
// Importe par le service worker Workbox (vite.config.js > workbox.importScripts).
// Affiche les notifications Web Push envoyees par le backend (Laravel WebPush) :
// colis livre, demande d'expedition refusee, bonus / retrait de parrainage,
// abonnement marketplace (bloque, paiement valide / rejete), annonce masquee.

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'TourShop';
  // Web Push ne permet pas d'imposer un son : celui-ci est choisi par le systeme.
  // Pour une meilleure audibilite on force donc la vibration et on re-alerte meme
  // si une notification du meme `tag` existe deja (renotify).
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: payload.data?.url || payload.url || '/', ...(payload.data || {}) },
    actions: payload.actions || [],
    silent: false,
    vibrate: [150, 80, 150, 80, 300],
    timestamp: Date.now(),
    // `renotify` n'est valide qu'avec un `tag` (sinon le navigateur leve une erreur).
    ...(payload.tag ? { tag: payload.tag, renotify: true } : {}),
  };

  // Relaye aussi le push aux onglets ouverts (toast in-app).
  const notifyClients = clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((windows) => windows.forEach((w) => w.postMessage({ type: 'push', payload })));

  event.waitUntil(Promise.all([self.registration.showNotification(title, options), notifyClients]));
});

// `data.url` : chemin relatif de l'app (ex. /expeditions/<id>, /parrainage) fourni
// par le backend (INTEGRATION_PUSH_NOTIFICATIONS_REACT.md, section 6). Résolu
// contre l'origine de l'app ; une URL absolue reste telle quelle.
const resolveUrl = (raw) => {
  try {
    return new URL(raw || '/', self.location.origin).href;
  } catch {
    return new URL('/', self.location.origin).href;
  }
};

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = resolveUrl(event.notification.data?.url);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      // Onglet déjà sur cette page : on le met au premier plan.
      const same = windows.find((w) => w.url === target && 'focus' in w);
      if (same) return same.focus();
      // Sinon on réutilise un onglet de l'app et on l'y amène.
      const existing = windows.find((w) => 'focus' in w && w.url.startsWith(self.location.origin));
      if (existing) {
        try {
          await existing.navigate(target);
        } catch {
          /* navigation refusée : on se rabat sur une nouvelle fenêtre */
          return clients.openWindow(target);
        }
        return existing.focus();
      }
      return clients.openWindow(target);
    })
  );
});
