import { toast } from 'sonner';
import { API_URL } from '../services/api';
import { formatPrice } from './format';
import { digitsOnly } from './digits';

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

// Devise de l'annonce, sinon celle de l'utilisateur (user.devise) : "FCFA"
// pour XOF/XAF, symbole ou code sinon (cf. utils/format).
export const formatMoney = (value, devise) => formatPrice(value, devise ? String(devise).toUpperCase() : undefined);

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

// Libelles des modes. Les 3 premiers sont les seuls actifs
// (MARKETPLACE_LIVRAISON_3_MODES.md) ; les anciens restent pour l'historique.
export const MODES_LIVRAISON = {
  standard: 'Standard',
  express: 'Express',
  livreur_magasin: 'Livreur du vendeur',
  reseau_livreurs: 'Réseau de livreurs',
  reseau: 'Réseau de livreurs',
  livreur_direct: 'Livreur choisi',
  direct: 'Livreur choisi',
  hors_plateforme: 'Hors plateforme',
};

// Mode effectif : porte par la livraison, sinon par la commande.
export const deliveryMode = (commande) => commande?.livraison_marketplace?.mode ?? commande?.mode_livraison ?? null;

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
// Refusee / expiree (livreur du magasin) : la commande revient `payee`, le
// vendeur designe un autre livreur.
export const isLivraisonActive = (liv) => Boolean(liv) && !['refusee', 'expiree'].includes(liv.statut);

// --- Etats du workflow de livraison (3 modes) --------------------------------

// Commande payee sans mode choisi : c'est a L'ACHETEUR de choisir.
export const needsDeliveryChoice = (commande) => commande?.statut === 'payee'
  && !commande.livraison_marketplace && !commande.mode_livraison;

// Livreur du magasin choisi par l'acheteur : le vendeur doit designer son
// livreur (au depart, ou apres un refus / une expiration du livreur).
export const needsMagasinAssignment = (commande) => {
  const liv = commande?.livraison_marketplace;
  return commande?.statut === 'payee' && liv?.mode === 'livreur_magasin' && !liv.livreur_id
    && (liv.statut === 'en_attente' || ['refusee', 'expiree'].includes(liv.statut));
};

// Livraison geree par le vendeur hors application : ancien mode hors_plateforme,
// ou livreur du magasin designe sans compte livreur (assignee, sans livreur_id).
export const isSelfDelivery = (commande) => {
  if (commande?.statut !== 'payee') return false;
  if (commande.mode_livraison === 'hors_plateforme') return true;
  const liv = commande.livraison_marketplace;
  return liv?.mode === 'livreur_magasin' && liv.statut === 'assignee' && !liv.livreur_id;
};

// Standard / express en attente d'un livreur (backoffice ou reseau).
export const isAwaitingCourier = (commande) => {
  const liv = commande?.livraison_marketplace;
  return commande?.statut === 'payee' && liv?.statut === 'en_attente' && ['standard', 'express'].includes(liv.mode);
};

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
  const shipping = s === 'livree' ? 'done' : s === 'payee' && (isSelfDelivery(commande) || isLivraisonActive(liv)) ? 'current' : 'todo';
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

// Plus de quartier saisi : `adresse` decrit le lieu, `ville` vient des communes
// du backoffice (`retrait_quartier` reste optionnel cote API, on ne l'envoie plus).
// `commune_id` : UUID de la commune choisie dans la liste (avec `ville` = son nom).
// Commune de depart de l'annonce / commune de livraison de l'acheteur : elles
// servent au calcul des tarifs de livraison (MARKETPLACE_LIVRAISON_3_MODES.md).
export const EMPTY_ADDRESS = {
  nom: '', telephone: '', adresse: '', ville: '', commune_id: null, latitude: null, longitude: null, instructions: '',
};

// { nom, ... } -> { retrait_nom, ..., commune_id } (annonce) ; ignore les champs vides.
export const toRetraitPayload = (addr) => {
  const out = {};
  ['nom', 'telephone', 'adresse', 'ville', 'latitude', 'longitude'].forEach((k) => {
    const raw = addr?.[k];
    const v = k === 'telephone' ? digitsOnly(raw) : raw;
    if (v !== undefined && v !== null && String(v).trim() !== '') out[`retrait_${k}`] = typeof v === 'string' ? v.trim() : v;
  });
  if (addr?.commune_id) out.commune_id = addr.commune_id;
  return out;
};

export const fromRetrait = (annonce) => ({
  ...EMPTY_ADDRESS,
  commune_id: annonce?.commune_id ?? null,
  nom: annonce?.retrait_nom ?? '',
  telephone: annonce?.retrait_telephone ?? '',
  adresse: annonce?.retrait_adresse ?? '',
  ville: annonce?.retrait_ville ?? '',
  latitude: annonce?.retrait_latitude ?? null,
  longitude: annonce?.retrait_longitude ?? null,
});

// Adresse exploitable par le livreur : contact, ville et coordonnees GPS
// (RECAP_GEOLOCALISATION_RETRAIT_MARKETPLACE.md). Les annonces anterieures a
// la regle peuvent ne pas les avoir.
export const hasRetraitAddress = (annonce) => Boolean(
  annonce?.retrait_nom && annonce?.retrait_telephone && annonce?.retrait_ville
  && annonce?.retrait_latitude != null && annonce?.retrait_longitude != null,
);

// Adresse de retrait exigee a la creation (y compris en brouillon : `store()`
// renvoie 422 sans nom, telephone, ville, latitude, longitude). `adresse` est
// en plus exigee par choix produit. La position GPS guide le livreur.
export const RETRAIT_REQUIRED = ['nom', 'telephone', 'ville', 'adresse', 'gps'];

// 422 Laravel `{ errors: { retrait_latitude: [...] } }` -> erreurs d'AddressFields.
export const retraitServerErrors = (err) => {
  const errors = err?.response?.status === 422 ? err.response.data?.errors : null;
  if (!errors || typeof errors !== 'object') return {};
  const out = {};
  Object.entries(errors).forEach(([key, msgs]) => {
    if (!key.startsWith('retrait_')) return;
    const field = key.slice('retrait_'.length);
    const name = field === 'latitude' || field === 'longitude' ? 'gps' : field;
    const msg = Array.isArray(msgs) ? msgs[0] : msgs;
    if (!out[name]) out[name] = name === 'gps' ? 'Position GPS du lieu de retrait manquante ou invalide.' : msg;
  });
  return out;
};

export const retraitErrors = (addr) => {
  const errs = {};
  ['nom', 'telephone', 'ville', 'adresse'].forEach((k) => {
    if (!String(addr?.[k] ?? '').trim()) errs[k] = 'Champ requis';
  });
  if (addr?.latitude == null || addr?.longitude == null) errs.gps = 'Enregistrez la position GPS du lieu de retrait.';
  return errs;
};
