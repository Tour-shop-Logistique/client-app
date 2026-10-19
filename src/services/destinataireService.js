import api from './api';
import { multipart } from './marketplaceService';
import paymentService from './paymentService';

// Parcours destinataire (user-parcour/CHANGEMENTS_APPS_CLIENT_LIVREUR.md §4).
// Un client peut suivre les colis qui lui sont destinés et demander une
// livraison à domicile quand l'expéditeur avait choisi le retrait en agence —
// il PAIE alors le livreur. Routes authentifiées, utilisateur de type `client`.

// GET /destinataire/mes-expeditions?page= — rapprochement sur
// `destinataire_user_id` OU sur le téléphone du compte. Paginé (20/page),
// avec agences et colis.
const myShipments = async (page = 1) => {
  const { data } = await api.get('/destinataire/mes-expeditions', { params: { page } });
  const p = data?.expeditions ?? data?.data ?? data;
  if (Array.isArray(p)) return { items: p, page: 1, lastPage: 1 };
  return {
    items: p?.data ?? [],
    page: p?.current_page ?? page,
    lastPage: p?.last_page ?? 1,
  };
};

// POST /destinataire/rechercher { code } — réponse volontairement réduite :
// pas de montants ni de données de l'expéditeur.
const search = async (code) => {
  const { data } = await api.post('/destinataire/rechercher', { code: code.trim() });
  return data?.expedition ?? null;
};

// POST /destinataire/{id}/demander-livraison — corps identique à
// demander-livraison côté client ({ mode, type_vehicule?, distance_km?,
// latitude?, longitude?, instructions? }). 201 : la mission, avec `montant_fixe`.
// 422 : livraison déjà prévue, aucun tarif pour la distance, taux express non
// configuré. 404 : expédition non destinée à cet utilisateur.
const requestDelivery = async (id, payload) => {
  const { data } = await api.post(`/destinataire/${id}/demander-livraison`, payload);
  return data;
};

// POST /destinataire/preuves-paiement — règlement des frais d'expédition /
// annexes par le destinataire (même forme que la route client).
const submitProof = async (fields) => {
  const { data } = await api.post('/destinataire/preuves-paiement', paymentService.proofForm(fields), multipart);
  return data;
};

// POST /destinataire/preuves-paiement/payer-livreur { mission_id, montant,
// methode_paiement, reference_transaction?, photo } — seulement si la livraison
// a été demandée par le destinataire (`livraison_payee_par_destinataire`).
const payDriver = async (fields) => {
  const { data } = await api.post('/destinataire/preuves-paiement/payer-livreur', paymentService.proofForm(fields), multipart);
  return data;
};

const destinataireService = {
  myShipments, search, requestDelivery, submitProof, payDriver,
};

export default destinataireService;
