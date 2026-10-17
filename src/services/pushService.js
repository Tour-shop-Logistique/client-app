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

// Le push marche dans Chrome (ordinateur et Android) SANS installer l'app : il
// suffit qu'un service worker soit actif. Il n'est enregistré que dans la version
// construite (`npm run build`, vite.config.js > devOptions.enabled: false) : en
// `npm run dev` il n'existe donc pas. `ready` attend l'activation (le clic peut
// arriver avant la fin de l'enregistrement) au lieu de lire un état instantané.
const WORKER_TIMEOUT_MS = 8000;

// Registration du service worker actif, ou null si aucun ne devient actif à temps.
const waitForRegistration = (timeoutMs = WORKER_TIMEOUT_MS) => Promise.race([
  navigator.serviceWorker.ready,
  new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
]);

const getRegistration = async () => {
  const reg = await waitForRegistration();
  if (!reg) {
    throw new Error(
      import.meta.env.DEV
        ? "Le service worker n'est pas actif en mode développement : testez sur la version construite (npm run build, puis npm run preview) ou sur le site déployé."
        : "Le service worker n'est pas encore prêt. Rechargez la page puis réessayez."
    );
  }
  return reg;
};

// Abonnement de cet appareil, lu une fois le service worker actif (au chargement
// il peut ne pas l'être encore : une lecture instantanée afficherait « désactivé »
// à tort). Attente courte : sans service worker (mode dev) on conclut vite à null.
const getCurrentSubscription = async () => {
  if (!isPushSupported()) return null;
  const reg = await waitForRegistration(3000);
  return reg ? reg.pushManager.getSubscription() : null;
};

// 'default' (pas encore demandé) | 'granted' | 'denied' | 'unsupported'.
const getPermission = () => (isPushSupported() ? Notification.permission : 'unsupported');

// GET /push/public-key -> POST /push/subscribe { endpoint, keys: { p256dh, auth } }
const subscribe = async () => {
  if (!isPushSupported()) throw new Error('Les notifications push ne sont pas prises en charge sur cet appareil.');
  // Déjà refusé : le navigateur ne redemande pas, il faut le réactiver à la main.
  if (Notification.permission === 'denied') {
    throw new Error('Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur (cadenas à côté de l’adresse > Notifications).');
  }
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
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("L'abonnement créé par le navigateur est incomplet. Réessayez.");
  }
  await api.post('/push/subscribe', {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
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
  getPermission,
};

export default pushService;
