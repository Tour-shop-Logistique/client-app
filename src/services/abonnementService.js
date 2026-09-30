import api from './api';
import { toFormData, multipart } from './marketplaceService';

// Abonnement marketplace (section 9 de MARKETPLACE_ET_ABONNEMENT_API.md).
// Ces routes restent accessibles meme quand l'utilisateur est bloque.

// GET /abonnement/statut -> { abonnement, echeance_courante, bloque }
// `abonnement` est null tant que le vendeur n'a jamais publie.
const statut = async () => {
  const { data } = await api.get('/abonnement/statut');
  return {
    abonnement: data.abonnement ?? null,
    echeanceCourante: data.echeance_courante ?? null,
    bloque: Boolean(data.bloque),
  };
};

// Pagination Laravel ; chaque echeance porte `paiement` (null si rien declare).
const historique = async (params = {}) => {
  const { data } = await api.get('/abonnement/historique', { params });
  return data.historique;
};

// Ne debloque PAS : seul le backoffice valide. Re-declarable apres un rejet.
const declarerPaiement = async (echeanceId, { methode, referenceTransaction, preuve }) => {
  const fd = toFormData({ methode, reference_transaction: referenceTransaction }, { preuve });
  const { data } = await api.post(`/abonnement/${echeanceId}/declarer-paiement`, fd, multipart);
  return data.paiement;
};

const abonnementService = { statut, historique, declarerPaiement };

export default abonnementService;
