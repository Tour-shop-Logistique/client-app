import api from './api';
import { multipart } from './marketplaceService';

// Interville: shipping between two communes of the same country (cahier 4.2)
// Extrapays: international shipping between countries (cahier 4.3), priced
// via the devis client API — see api-devis-client.md.
// Missions, offres, preuves, evaluation et factures : contrat dans
// REPONSE_AUDIT_CAHIER_DES_CHARGES_CLIENT.md.

// GET /api/communes?code_pays= — public list of a country's active communes,
// { id, nom } only, sorted by name. First call of the interville flow: gives the
// `destinataire_commune_id` needed by simulate-interville / store.
// See docs/api-simulation-et-formats-client.md.
const listCommunes = async (codePays) => {
  const { data } = await api.get('/communes', { params: { code_pays: codePays } });
  return data;
};

// GET /api/expedition/client/formats-colis — colis formats (Petit/Moyen/Grand…)
// of the backoffice. Public : connecté, le pays vient de User.code_pays ; invité,
// passer `code_pays` (REPONSE_DEMANDE_BACKEND_APP_CLIENT_COMPLETE.md A2). Sorted
// by `ordre`; exactly one `is_default: true`; a null max = unlimited.
const getColisFormats = async (codePays) => {
  const { data } = await api.get('/expedition/client/formats-colis', {
    params: codePays ? { code_pays: codePays } : undefined,
  });
  return data;
};

// GET /api/expedition/client/grille-tarifs-enlevement?commune_id= — grille brute
// des tarifs d'enlèvement groupage par tranche de km et véhicule. Format de
// réponse non documenté côté app (lecture défensive : utils/pickup.js).
const getPickupTariffGrid = async (communeId) => {
  const { data } = await api.get('/expedition/client/grille-tarifs-enlevement', { params: { commune_id: communeId } });
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
  const { data } = await api.post('/expedition/client/simulate-interville', payload);
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
  return data;
};

// Nested multipart body, Laravel style: `colis[0][poids]`, `colis[0][photo]`,
// `colis[0][articles][0][produit_id]`. Empty values are dropped.
const toNestedFormData = (value, fd = new FormData(), prefix = '') => {
  if (value === undefined || value === null || value === '') return fd;
  if (value instanceof File || value instanceof Blob) {
    fd.append(prefix, value);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => toNestedFormData(item, fd, `${prefix}[${i}]`));
  } else if (typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => toNestedFormData(item, fd, prefix ? `${prefix}[${key}]` : key));
  } else {
    fd.append(prefix, typeof value === 'boolean' ? (value ? '1' : '0') : value);
  }
  return fd;
};

// Registers a shipment after the devis step — see
// api-enregistrement-expedition-client.md for the payload/response per mode.
// A colis may carry a `photo` (File: jpeg/png/jpg/webp, 5 Mo max) in modes
// `interville` and `livraison_domicile`: the body is then sent as multipart.
const storeExpedition = async (payload) => {
  const hasPhoto = (payload.colis ?? []).some((c) => c.photo instanceof File);
  const { data } = hasPhoto
    ? await api.post('/expedition/client/store', toNestedFormData(payload), multipart)
    : await api.post('/expedition/client/store', payload);
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

// GET /api/expedition/client/show/{id} — détail d'une expédition du client, avec
// les dates de chaque jalon (`date_*`) et `code_validation_reception`.
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

// --- Missions du dernier kilomètre (enlèvement, livraison à domicile) --------

// GET /api/expedition/client/{id}/missions -> { success, data: [{ id, type,
// statut, preuve: { photo_url, signature_data, latitude, longitude, horodatage } | null }] }
const clientMissions = async (id) => {
  const { data } = await api.get(`/expedition/client/${id}/missions`);
  return data;
};

// GET /api/expedition/client/missions/{missionId}/offres — offres des livreurs
// sur une mission express encore ouverte.
const missionOffers = async (missionId) => {
  const { data } = await api.get(`/expedition/client/missions/${missionId}/offres`);
  return data;
};

// POST .../missions/{missionId}/offres/{offreId}/accepter — les autres offres
// passent `refusee`, la mission `assignee`, le code de réception est envoyé au
// destinataire (SMS + email).
const acceptOffer = async (missionId, offreId) => {
  const { data } = await api.post(`/expedition/client/missions/${missionId}/offres/${offreId}/accepter`);
  return data;
};

// POST .../missions/{missionId}/annuler — possible tant que la mission est
// `en_attente` (aucun livreur assigné) ; les offres actives sont refusées.
const cancelMission = async (missionId) => {
  const { data } = await api.post(`/expedition/client/missions/${missionId}/annuler`);
  return data;
};

// --- Évaluation ---------------------------------------------------------------

// GET /api/expedition/client/{id}/evaluation -> { data: null | { id, note, commentaire, created_at } }
const getEvaluation = async (id) => {
  const { data } = await api.get(`/expedition/client/${id}/evaluation`);
  return data;
};

// POST /api/expedition/client/{id}/evaluation — note 1..5 (requise), commentaire
// optionnel (1000 max). 422 si l'expédition n'est pas `termined` ou déjà évaluée.
const rate = async (id, { note, commentaire }) => {
  const { data } = await api.post(`/expedition/client/${id}/evaluation`, {
    note,
    commentaire: commentaire || undefined,
  });
  return data;
};

// --- Factures -----------------------------------------------------------------

// GET /api/expedition/client/factures — toutes les factures du client, avec
// l'expédition associée en aperçu (reference, pays_depart, pays_destination).
const listInvoices = async () => {
  const { data } = await api.get('/expedition/client/factures');
  return data;
};

// GET /api/expedition/client/factures/{id}/download — PDF binaire.
const downloadInvoice = async (id) => {
  const { data } = await api.get(`/expedition/client/factures/${id}/download`, { responseType: 'blob' });
  return data;
};

const expeditionService = {
  listCommunes,
  getColisFormats,
  getPickupTariffGrid,
  simulateInterville,
  listAvailableDestinations,
  getDevis,
  storeExpedition,
  clientList,
  clientShow,
  clientCancel,
  clientStatistics,
  clientMissions,
  missionOffers,
  acceptOffer,
  cancelMission,
  getEvaluation,
  rate,
  listInvoices,
  downloadInvoice,
};

export default expeditionService;
