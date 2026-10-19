// Parcours destinataire (user-parcour/CHANGEMENTS_APPS_CLIENT_LIVREUR.md §4).
// Pas de route de détail côté destinataire : les expéditions vues dans la liste
// ou trouvées par code sont gardées en mémoire pour l'écran de détail.

const cache = new Map();

export const rememberReceived = (list) => {
  (Array.isArray(list) ? list : [list]).forEach((e) => { if (e?.id) cache.set(String(e.id), { ...cache.get(String(e.id)), ...e }); });
};

export const getReceived = (id) => cache.get(String(id)) || null;

// Mission de livraison créée par le destinataire (réponse 201 de
// demander-livraison) : conservée localement pour pouvoir payer le livreur
// ensuite, l'API destinataire ne listant pas les missions.
const MISSIONS_KEY = 'destinataire_missions_livraison';

const readMissions = () => {
  try { return JSON.parse(localStorage.getItem(MISSIONS_KEY)) || {}; } catch { return {}; }
};

export const saveRecipientMission = (expeditionId, mission) => {
  if (!expeditionId || !mission?.id) return;
  try {
    const all = readMissions();
    all[expeditionId] = mission;
    localStorage.setItem(MISSIONS_KEY, JSON.stringify(all));
  } catch { /* stockage indisponible : non bloquant */ }
};

// Mission de livraison du destinataire : embarquée dans l'expédition si l'API
// la fournit, sinon celle mémorisée à la demande.
export const recipientMission = (exp) => {
  const embedded = (exp?.missions ?? []).find((m) => m.type === 'livraison' && m.statut !== 'annulee');
  return embedded || readMissions()[exp?.id] || null;
};

// Livraison à domicile demandable : colis arrivé à destination, pas encore livré.
export const ARRIVED_STATUSES = ['arrivee_expedition_succes', 'recu_agence_destination'];
export const canRequestHomeDelivery = (exp) =>
  Boolean(exp) && exp.is_livraison_domicile === false && ARRIVED_STATUSES.includes(exp.statut_expedition);
