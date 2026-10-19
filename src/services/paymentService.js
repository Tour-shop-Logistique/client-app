import api from './api';
import { toFormData, multipart } from './marketplaceService';

// Paiement à distance avec preuves (user-parcour/CHANGEMENTS_APPS_CLIENT_LIVREUR.md §3).
// Aucun paiement ne transite par la plateforme : le client paie HORS application
// sur un numéro fourni par l'agence, puis dépose une preuve que l'agence
// confirme ou rejette (`en_attente` -> `confirmee` | `rejetee` + `motif_rejet`).

export const PAYMENT_METHODS = [
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'bank_transfer', label: 'Virement bancaire' },
  { value: 'cash', label: 'Espèces' },
  { value: 'card', label: 'Carte' },
  { value: 'other', label: 'Autre' },
];

export const PAYMENT_OBJECTS = [
  { value: 'tout_compris', label: 'Règlement global', hint: 'Tout ce qui reste à payer' },
  { value: 'montant_expedition', label: 'Prix de l’expédition', hint: 'Prix de base de l’envoi' },
  { value: 'frais_annexes', label: 'Frais annexes', hint: 'Douane, assurance… ajoutés après contrôle' },
  { value: 'frais_enlevement', label: 'Frais d’enlèvement', hint: 'Enlèvement à domicile' },
  { value: 'frais_livraison', label: 'Frais de livraison', hint: 'Livraison à domicile' },
];

export const PROOF_STATUS = {
  en_attente: { label: 'En vérification', className: 'bg-amber-50 text-amber-700' },
  confirmee: { label: 'Confirmée', className: 'bg-emerald-50 text-emerald-700' },
  rejetee: { label: 'Rejetée', className: 'bg-red-50 text-red-700' },
};

export const methodLabel = (v) => PAYMENT_METHODS.find((m) => m.value === v)?.label || v || '—';
export const objectLabel = (v) => PAYMENT_OBJECTS.find((o) => o.value === v)?.label || v || '—';

// GET /expedition/client/agence/{agenceId}/moyens-paiement — moyens ACTIFS de
// l'agence de départ : [{ id, methode, numero_destinataire, libelle }].
const agencyMethods = async (agenceId) => {
  const { data } = await api.get(`/expedition/client/agence/${agenceId}/moyens-paiement`);
  return data?.moyens_paiement ?? data?.data ?? [];
};

const proofForm = ({
  expeditionId, missionId, objet, montant, methode, reference, photo,
}) => toFormData({
  expedition_id: expeditionId,
  mission_id: missionId,
  objet_paiement: objet,
  montant,
  methode_paiement: methode,
  reference_transaction: reference?.trim() || undefined,
}, { photo });

// POST /expedition/client/preuves-paiement (multipart) — expéditeur ou
// destinataire de l'expédition, sinon 403. 201 { preuve: { id, statut, montant } }.
const submitProof = async (fields) => {
  const { data } = await api.post('/expedition/client/preuves-paiement', proofForm(fields), multipart);
  return data;
};

// GET /expedition/client/{id}/preuves-paiement — historique et statut des preuves.
const listProofs = async (expeditionId) => {
  const { data } = await api.get(`/expedition/client/${expeditionId}/preuves-paiement`);
  return data?.preuves ?? data?.data ?? [];
};

const paymentService = { agencyMethods, submitProof, listProofs, proofForm };

export default paymentService;
