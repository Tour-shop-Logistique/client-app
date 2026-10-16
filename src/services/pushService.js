import api from './api';

// Abonnement Web Push (api-profil-et-notifications-client.md, section push).
// Recoit les notifications client : colis livre, demande d'expedition refusee,
// parrainage (bonus credite, retrait enregistre), abonnement marketplace
// (bloque, paiement valide / rejete), annonce masquee par la moderation
// (NOTIFICATIONS_A_INTEGRER.md). Le service worker genere par vite-plugin-pwa
// importe public/push-sw.js qui affiche les notifications.
// Meme implementation que l'app livreur (pushService.js).

const urlBase64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

// Contrat : { success, public_key }. Autres noms lus en repli (clé VAPID,
// éventuellement imbriquée sous `data`).
const extractPublicKey = (payload) => {
  const src = payload?.data && typeof payload.data === 'object' ? { ...payload, ...payload.data } : payload;
  const value = src?.public_key ?? src?.publicKey ?? src?.vapid_public_key ?? src?.vapidPublicKey ?? src?.key;
  return typeof value === 'string' ? value.trim() : '';
};

export const isPushSupported = () =>
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window;

const getRegistration = async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error("Le service worker n'est pas actif (disponible uniquement sur l'app installée / build de production).");
  return reg;
};

const getCurrentSubscription = async () => {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
};

// GET /push/public-key -> POST /push/subscribe { endpoint, keys: { p256dh, auth } }
const subscribe = async () => {
  if (!isPushSupported()) throw new Error('Les notifications push ne sont pas prises en charge sur cet appareil.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Autorisation de notification refusée.');

  const reg = await getRegistration();
  const { data } = await api.get('/push/public-key');
  // Clé VAPID absente (non configurée côté serveur) : sans elle aucun abonnement
  // n'est possible — message clair plutôt qu'un TypeError sur `null.length`.
  const publicKey = extractPublicKey(data);
  if (!publicKey) {
    console.warn('[push] Réponse de GET /push/public-key sans clé exploitable :', data);
    throw new Error("Les notifications ne sont pas encore disponibles : le serveur n'a pas de clé d'envoi configurée.");
  }

  const options = { userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) };
  // subscribe() renvoie l'abonnement existant si la clé est la même, et lève
  // InvalidStateError si un ancien abonnement a été créé avec une autre clé :
  // on le supprime alors et on se réabonne avec la clé actuelle.
  let subscription;
  try {
    subscription = await reg.pushManager.subscribe(options);
  } catch (err) {
    if (err?.name !== 'InvalidStateError') throw err;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
    subscription = await reg.pushManager.subscribe(options);
  }

  const json = subscription.toJSON();
  await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
  return true;
};

// POST /push/unsubscribe { endpoint }
const unsubscribe = async () => {
  const subscription = await getCurrentSubscription();
  if (!subscription) return false;
  await api.post('/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {});
  await subscription.unsubscribe();
  return true;
};

const pushService = {
  subscribe,
  unsubscribe,
  getCurrentSubscription,
};

export default pushService;
