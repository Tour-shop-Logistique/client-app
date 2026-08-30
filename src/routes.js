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
  MARKETPLACE_SELL: '/marketplace/vendre',
  MARKETPLACE_MY_LISTINGS: '/marketplace/mes-annonces',
  AGENCIES: '/agences',
  AGENCY_DETAIL: '/agences/:id',
  PROFILE: '/profil',
  PROFILE_REFERRAL: '/profil/parrainage',
  PROFILE_INVOICES: '/profil/factures',
  LOGIN: '/connexion',
  REGISTER: '/inscription',
};

export const trackingPath = (id) => `/expeditions/${id}/suivi`;
export const expeditionDetailPath = (id) => `/expeditions/${id}`;
export const productPath = (id) => `/marketplace/produits/${id}`;
export const agencyPath = (id) => `/agences/${id}`;
