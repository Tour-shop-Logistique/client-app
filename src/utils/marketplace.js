import { toast } from 'sonner';
import { API_URL } from '../services/api';
import { formatPrice } from './format';

// Les medias TourShop sont stockes dans le bucket Supabase `tourshop-media`
// (logos/photos d'agences renvoyes en URL absolue). Les photos/preuves
// marketplace arrivent en chemin relatif ("marketplace/produits/<id>/xxx.jpg") :
// on les sert depuis ce bucket. `${API_URL}/storage` (disque public Laravel)
// reste en secours via `handleMediaError`.
const MEDIA_URL = (
  import.meta.env.VITE_MEDIA_URL ??
  'https://siuflfdbhkqrstwsuove.supabase.co/storage/v1/object/public/tourshop-media'
).replace(/\/+$/, '');

const API_STORAGE = `${API_URL}/storage/`;

const cleanPath = (path) => String(path).replace(/^\/+/, '').replace(/^storage\//, '');

export const storageUrl = (path) => {
  if (!path || typeof path !== 'string') return null;
  if (/^(blob:|data:)/i.test(path)) return path;
  // Anciennes URLs `${API_URL}/storage/...` (ex. favoris/panier persistes) -> bucket.
  if (API_URL && path.startsWith(API_STORAGE)) return `${MEDIA_URL}/${cleanPath(path.slice(API_STORAGE.length))}`;
  if (/^https?:/i.test(path)) return path;
  return `${MEDIA_URL}/${cleanPath(path)}`;
};

// URL de secours (disque public Laravel) pour une URL du bucket, sinon null.
export const mediaFallback = (url) =>
  API_URL && url?.startsWith(`${MEDIA_URL}/`) ? `${API_STORAGE}${url.slice(MEDIA_URL.length + 1)}` : null;

// onError d'un <img> : tente une fois l'URL de secours. Renvoie false si epuise.
export const handleMediaError = (e) => {
  const img = e.currentTarget;
  const fallback = mediaFallback(img.src);
  if (fallback && !img.dataset.fallback) {
    img.dataset.fallback = '1';
    img.src = fallback;
    return true;
  }
  return false;
};

export const annoncePhotos = (annonce) =>
  [...(annonce?.photos ?? [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).map((p) => ({ ...p, url: storageUrl(p.path) }));

export const annonceCover = (annonce) => annoncePhotos(annonce)[0]?.url ?? null;

// Devise libre (defaut XOF) : on affiche "FCFA" pour XOF/XAF, sinon le code.
export const formatMoney = (value, devise = 'XOF') =>
  formatPrice(value, !devise || devise === 'XOF' || devise === 'XAF' ? 'FCFA' : devise);

// Badge "Nouveau" : annonce publiee (ou creee) il y a moins de 3 jours.
export const isNewAnnonce = (annonce) => {
  const t = Date.parse(annonce?.publiee_le ?? annonce?.created_at ?? '');
  return Number.isFinite(t) && Date.now() - t < 3 * 86400000;
};

export const personName = (p) => [p?.prenoms, p?.nom].filter(Boolean).join(' ') || 'Utilisateur';

export const initials = (p) =>
  [p?.prenoms, p?.nom].filter(Boolean).map((s) => s.trim()[0]).join('').slice(0, 2).toUpperCase() || '?';

// --- Statuts -----------------------------------------------------------------

export const ANNONCE_STATUTS = {
  brouillon: { label: 'Brouillon', tone: 'neutral' },
  publiee: { label: 'En ligne', tone: 'success' },
  depubliee: { label: 'Dépubliée', tone: 'warning' },
  vendue: { label: 'Vendue', tone: 'info' },
  masquee: { label: 'Masquée (modération)', tone: 'danger' },
};

export const COMMANDE_STATUTS = {
  en_attente_paiement: { label: 'En attente de paiement', short: 'À payer', tone: 'warning' },
  paiement_a_confirmer: { label: 'Paiement à confirmer', short: 'À confirmer', tone: 'info' },
  payee: { label: 'Payée', short: 'Payée', tone: 'success' },
  livree: { label: 'Livrée', short: 'Livrée', tone: 'success' },
  annulee: { label: 'Annulée', short: 'Annulée', tone: 'neutral' },
};

// Annulable (acheteur ou vendeur) tant que la commande n'est pas payee.
export const isCommandeAnnulable = (commande) => ['en_attente_paiement', 'paiement_a_confirmer'].includes(commande?.statut);

export const LIVRAISON_STATUTS = {
  en_attente: { label: 'En attente de livreur', tone: 'warning' },
  proposee: { label: 'En attente du livreur', tone: 'warning' },
  refusee: { label: 'Refusée par le livreur', tone: 'danger' },
  expiree: { label: 'Sans réponse du livreur', tone: 'danger' },
  assignee: { label: 'Livreur assigné', tone: 'info' },
  en_cours: { label: 'En cours de livraison', tone: 'info' },
  terminee: { label: 'Livrée', tone: 'success' },
};

export const MODES_LIVRAISON = {
  reseau_livreurs: 'Réseau de livreurs',
  livreur_direct: 'Livreur choisi',
  hors_plateforme: 'Hors plateforme',
};

export const ECHEANCE_STATUTS = {
  a_payer: { label: 'À payer', tone: 'neutral' },
  rappel_envoye: { label: 'Échéance proche', tone: 'warning' },
  en_retard: { label: 'En retard', tone: 'danger' },
  payee: { label: 'Payée', tone: 'success' },
};

export const PAIEMENT_ABONNEMENT_STATUTS = {
  en_attente: { label: 'En attente de validation', tone: 'info' },
  valide: { label: 'Validé', tone: 'success' },
  rejete: { label: 'Rejeté', tone: 'danger' },
};

// Enum PaymentMethod. En pratique : cash et mobile_money.
export const PAYMENT_METHODS = {
  mobile_money: 'Mobile money',
  cash: 'Cash à la livraison',
  bank_transfer: 'Virement bancaire',
  card: 'Carte bancaire',
  other: 'Autre',
};

export const TONE_CLASSES = {
  neutral: 'bg-surface-100 text-surface-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  info: 'bg-primary-50 text-primary-700',
  danger: 'bg-red-50 text-red-700',
};

// Livraison encore portee par un livreur (ou en attente de son accord).
// Refusee / expiree : la commande revient `payee`, le vendeur re-choisit.
export const isLivraisonActive = (liv) => Boolean(liv) && !['refusee', 'expiree'].includes(liv.statut);

// Adresse snapshot de la commande : `livraison_*` (acheteur) ou `retrait_*` (vendeur).
export const commandeAddress = (commande, prefix) => {
  const get = (k) => commande?.[`${prefix}_${k}`] ?? null;
  const addr = {
    nom: get('nom'),
    telephone: get('telephone'),
    adresse: get('adresse'),
    quartier: get('quartier'),
    ville: get('ville'),
    latitude: get('latitude'),
    longitude: get('longitude'),
    instructions: get('instructions'),
  };
  return addr.adresse || addr.ville || addr.nom ? addr : null;
};

// Etapes de la frise commande (acheteur et vendeur).
export const orderSteps = (commande) => {
  const s = commande?.statut;
  const liv = commande?.livraison_marketplace;
  const order = ['en_attente_paiement', 'paiement_a_confirmer', 'payee', 'livree'];
  const idx = order.indexOf(s);
  const shipping = s === 'livree' ? 'done' : s === 'payee' && (commande?.mode_livraison === 'hors_plateforme' || isLivraisonActive(liv)) ? 'current' : 'todo';
  return [
    { key: 'commande', label: 'Commande', state: 'done' },
    { key: 'paiement', label: 'Paiement', state: idx >= 2 ? 'done' : 'current' },
    { key: 'livraison', label: 'Livraison', state: idx >= 2 ? shipping : 'todo' },
    { key: 'recu', label: 'Reçue', state: s === 'livree' ? 'done' : 'todo' },
  ];
};

export const copyText = async (text, label = 'Copié') => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error('Copie impossible');
  }
};

// --- Erreurs -----------------------------------------------------------------

export const isAbonnementBloque = (err) =>
  err?.response?.status === 403 && err?.response?.data?.code === 'ABONNEMENT_BLOQUE';

// Message lisible : message serveur, sinon 1re erreur de validation Laravel.
export const apiErrorMessage = (err, fallback = 'Une erreur est survenue.') => {
  const data = err?.response?.data;
  if (data?.message && data.message !== 'Erreur serveur.') return data.message;
  const first = data?.errors && typeof data.errors === 'object' ? Object.values(data.errors).flat()[0] : null;
  return first || fallback;
};

// --- Adresses (retrait vendeur / livraison acheteur) -------------------------

export const EMPTY_ADDRESS = {
  nom: '', telephone: '', adresse: '', quartier: '', ville: '', latitude: null, longitude: null, instructions: '',
};

// { nom, ... } -> { retrait_nom, ... } (annonce) ; ignore les champs vides.
export const toRetraitPayload = (addr) => {
  const out = {};
  ['nom', 'telephone', 'adresse', 'quartier', 'ville', 'latitude', 'longitude'].forEach((k) => {
    const v = addr?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') out[`retrait_${k}`] = typeof v === 'string' ? v.trim() : v;
  });
  return out;
};

export const fromRetrait = (annonce) => ({
  ...EMPTY_ADDRESS,
  nom: annonce?.retrait_nom ?? '',
  telephone: annonce?.retrait_telephone ?? '',
  adresse: annonce?.retrait_adresse ?? '',
  quartier: annonce?.retrait_quartier ?? '',
  ville: annonce?.retrait_ville ?? '',
  latitude: annonce?.retrait_latitude ?? null,
  longitude: annonce?.retrait_longitude ?? null,
});

export const hasRetraitAddress = (annonce) => Boolean(annonce?.retrait_adresse || annonce?.retrait_ville);
