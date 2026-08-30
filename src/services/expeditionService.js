import api from './api';

// Interville: shipping between two cities of the same country (cahier 4.2)
// Extrapays: international shipping between countries (cahier 4.3), priced
// via the devis client API — see api-devis-client.md.

const estimateInterville = async ({ villeDepart, villeDestination, poids, taille }) => {
  const { data } = await api.post('/expeditions/interville/estimation', {
    ville_depart: villeDepart,
    ville_destination: villeDestination,
    poids,
    taille,
  });
  return data;
};

// mode: 'livraison_domicile' | 'recuperation_agence' — see api-devis-client.md
const getDevis = async (payload) => {
  const { data } = await api.post('/expedition/client/devis', payload);
   console.log('getDevis response:', data);
  return data;
 
};

const createInterville = async (payload) => {
  const { data } = await api.post('/expeditions/interville', payload);
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
  estimateInterville,
  getDevis,
  createInterville,
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
