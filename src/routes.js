export const ROUTES = {
  HOME: '/',
  EXPEDITION_NEW: '/expeditions/nouvelle',
  EXPEDITION_INTERVILLE: '/expeditions/interville',
  EXPEDITION_EXTRAPAYS: '/expeditions/extrapays',
  EXPEDITION_TRACKING: '/expeditions/:id/suivi',
  EXPEDITION_DETAIL: '/expeditions/:id',
  EXPEDITION_HISTORY: '/expeditions',
  MARKETPLACE: '/marketplace',
  MARKETPLACE_PRODUCT: '/marketplace/produits/:id',
  MARKETPLACE_CART: '/marketplace/panier',
  MARKETPLACE_FAVORITES: '/marketplace/favoris',
  MARKETPLACE_ORDERS: '/marketplace/achats',
  MARKETPLACE_ORDER: '/marketplace/achats/:id',
  MARKETPLACE_SELLER: '/marketplace/vendeur',
  MARKETPLACE_SELL: '/marketplace/vendre',
  MARKETPLACE_MY_LISTINGS: '/marketplace/mes-annonces',
  MARKETPLACE_LISTING_EDIT: '/marketplace/mes-annonces/:id',
  MARKETPLACE_SALES: '/marketplace/ventes',
  MARKETPLACE_SALE: '/marketplace/ventes/:id',
  MARKETPLACE_PAYMENT_METHODS: '/marketplace/moyens-paiement',
  MARKETPLACE_BALANCE: '/marketplace/solde',
  MARKETPLACE_SUBSCRIPTION: '/marketplace/abonnement',
  AGENCIES: '/agences',
  AGENCY_DETAIL: '/agences/:id',
  PROFILE: '/profil',
  PROFILE_EDIT: '/profil/modifier',
  PROFILE_PASSWORD: '/profil/mot-de-passe',
  PROFILE_ADDRESSES: '/profil/adresses',
  PROFILE_DELETE: '/profil/supprimer',
  PROFILE_REFERRAL: '/profil/parrainage',
  PROFILE_INVOICES: '/profil/factures',
  LOGIN: '/connexion',
  REGISTER: '/inscription',
};

export const trackingPath = (id) => `/expeditions/${id}/suivi`;
export const expeditionDetailPath = (id) => `/expeditions/${id}`;
export const productPath = (id) => `/marketplace/produits/${id}`;
export const orderPath = (id) => `/marketplace/achats/${id}`;
export const salePath = (id) => `/marketplace/ventes/${id}`;
export const listingEditPath = (id) => `/marketplace/mes-annonces/${id}`;
export const agencyPath = (id) => `/agences/${id}`;
