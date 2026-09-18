import api from './api';

// Interville: shipping between two communes of the same country (cahier 4.2)
// Extrapays: international shipping between countries (cahier 4.3), priced
// via the devis client API — see api-devis-client.md.

// GET /api/communes?code_pays= — public list of a country's active communes,
// { id, nom } only, sorted by name. First call of the interville flow: gives the
// `destinataire_commune_id` needed by simulate-interville / store.
// See docs/api-simulation-et-formats-client.md.
const listCommunes = async (codePays) => {
  const { data } = await api.get('/communes', { params: { code_pays: codePays } });
  return data;
};

// GET /api/expedition/client/formats-colis — colis formats (Petit/Moyen/Grand…)
// of the client's backoffice, resolved from User.code_pays (no params). Auth
// (client). Sorted by `ordre`; exactly one `is_default: true`; a null
// max = unlimited. Used to build the format picker for interville.
const getColisFormats = async () => {
  const { data } = await api.get('/expedition/client/formats-colis');
  return data;
};

// POST /api/expedition/client/simulate-interville — the ONLY way to simulate an
// interville tariff (the public `devis` covers LD/Groupage only). Auth (client).
// Call it with type_expedition: "interville". On success the result is
// double-wrapped: `data.data.{ success, tarif, colis }` (tarif has
// montant_base / pourcentage_prestation / montant_prestation / montant_expedition,
// per-colis detail in `data.colis`). On failure: a flat { success:false, message }
// (HTTP 422) — always show `message` as-is.

const simulateInterville = async (payload) => {
  console.log('simulateInterville payload:', payload);
  const { data } = await api.post('/expedition/client/simulate-interville', payload);
  console.log('simulateInterville response:', data);
  return data;
};

// GET /api/expedition/client/pays-disponibles?code_pays=<DEPART> — public.
// Call BEFORE the devis: returns only destination countries that actually have
// at least one active tariff from the departure backoffice, each with a boolean
// per type (ld / groupage_afrique / groupage_ca / groupage_dhd_aerien /
// groupage_dhd_maritime). A country with a zone but no active tariff is absent.
// See api-devis-client.md.
const listAvailableDestinations = async (codePaysDepart) => {
  const { data } = await api.get('/expedition/client/pays-disponibles', {
    params: { code_pays: codePaysDepart },
  });
  return data;
};

// mode: 'livraison_domicile' | 'recuperation_agence' — see api-devis-client.md
const getDevis = async (payload) => {
  const { data } = await api.post('/expedition/client/devis', payload);
   console.log('getDevis response:', data);
  return data;

};

// Registers an extrapays shipment request after the devis step — see
// api-enregistrement-expedition-client.md for the full payload/response shape
// for both modes (livraison_domicile / recuperation_agence).
const storeExpedition = async (payload) => {
  console.log('storeExpedition payload:', payload);
  const { data } = await api.post('/expedition/client/store', payload);
  console.log('storeExpedition response:', data);
  return data;
};

const list = async (params = {}) => {
  const { data } = await api.get('/expeditions', { params });
  return data;
};

const getById = async (id) => {
  const { data } = await api.get(`/expeditions/${id}`);
  return data;
};

// --- API client documentée (api-enregistrement-expedition-client.md) ---------

// GET /api/expedition/client/list — liste complète (pas de pagination) des
// expéditions du client connecté. `{ success, message, data: [...] }`.
// Filtres query optionnels : statut, type_expedition, date_debut, date_fin.
const clientList = async (params = {}) => {
  const { data } = await api.get('/expedition/client/list', { params });
  return data;
};

// GET /api/expedition/client/show/{id} — détail d'une expédition du client.
const clientShow = async (id) => {
  const { data } = await api.get(`/expedition/client/show/${id}`);
  return data;
};

// PUT /api/expedition/client/cancel/{id} — annule une demande encore
// `en_attente` ou `accepted`. `motif_annulation` requis (max 500).
const clientCancel = async (id, motif) => {
  const { data } = await api.put(`/expedition/client/cancel/${id}`, { motif_annulation: motif });
  return data;
};

// GET /api/expedition/client/statistics — compteurs agrégés (tous statuts).
const clientStatistics = async () => {
  const { data } = await api.get('/expedition/client/statistics');
  return data;
};

const chooseDeliveryOffer = async (id, livreurOfferId) => {
  const { data } = await api.post(`/expeditions/${id}/offres/${livreurOfferId}/accepter`);
  return data;
};

const confirmDelivery = async (id, code) => {
  const { data } = await api.post(`/expeditions/${id}/confirmer-livraison`, { code });
  return data;
};

const rate = async (id, { note, commentaire }) => {
  const { data } = await api.post(`/expeditions/${id}/evaluation`, { note, commentaire });
  return data;
};

const downloadInvoice = async (id) => {
  const { data } = await api.get(`/expeditions/${id}/facture`, { responseType: 'blob' });
  return data;
};

const expeditionService = {
  listCommunes,
  getColisFormats,
  simulateInterville,
  listAvailableDestinations,
  getDevis,
  storeExpedition,
  list,
  getById,
  clientList,
  clientShow,
  clientCancel,
  clientStatistics,
  chooseDeliveryOffer,
  confirmDelivery,
  rate,
  downloadInvoice,
};

export default expeditionService;
