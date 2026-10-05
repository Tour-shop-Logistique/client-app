// Statuts et types d'expédition côté client — voir api-enregistrement-expedition-client.md.

// Statuts intermédiaires regroupés sous "En cours" côté UI (cf. le champ
// `en_cours` de GET /api/expedition/client/statistics).
export const EN_COURS_STATUSES = [
  'en_cours_enlevement',
  'en_cours_depot',
  'recu_agence_depart',
  'en_transit_entrepot',
  'depart_expedition_succes',
  'arrivee_expedition_succes',
  'recu_agence_destination',
  'en_cours_livraison',
];

const STATUT_META = {
  en_attente: { label: 'En attente', className: 'bg-amber-50 text-amber-700' },
  accepted: { label: 'Acceptée', className: 'bg-primary-50 text-primary-700' },
  refused: { label: 'Refusée', className: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Annulée', className: 'bg-surface-100 text-surface-500' },
  termined: { label: 'Terminée', className: 'bg-emerald-50 text-emerald-700' },
};

// Libellé précis de chaque statut intermédiaire (les filtres de la page Colis
// les regroupent toujours sous "En cours").
const EN_COURS_LABELS = {
  en_cours_enlevement: 'Enlèvement en cours',
  en_cours_depot: "Dépôt à l'agence",
  recu_agence_depart: "Reçu à l'agence de départ",
  en_transit_entrepot: "Vers l'entrepôt",
  depart_expedition_succes: 'Parti vers la destination',
  arrivee_expedition_succes: 'Arrivé à destination',
  recu_agence_destination: "Reçu à l'agence d'arrivée",
  en_cours_livraison: 'En cours de livraison',
};

export const getStatutMeta = (statut) => {
  if (STATUT_META[statut]) return STATUT_META[statut];
  if (EN_COURS_STATUSES.includes(statut)) {
    return { label: EN_COURS_LABELS[statut] || 'En cours', className: 'bg-primary-50 text-primary-700' };
  }
  return { label: statut || 'Inconnu', className: 'bg-surface-100 text-surface-600' };
};

// Jalons du suivi : une date `null` = étape pas encore atteinte (REPONSE_AUDIT §1).
// `optional` : affiché seulement si la date existe (enlèvement à domicile) ;
// `international` : réservé aux expéditions entre deux pays.
const MILESTONES = [
  { key: 'enleve', label: "Récupéré chez l'expéditeur", date: 'date_enlevement_client', optional: true },
  { key: 'depot', label: "Déposé à l'agence de départ", date: 'date_livraison_agence' },
  { key: 'entrepot', label: "Transféré à l'entrepôt", date: 'date_deplacement_entrepot', international: true },
  { key: 'depart', label: 'Parti du pays de départ', date: 'date_expedition_depart', international: true },
  { key: 'arrivee', label: 'Arrivé dans le pays de destination', date: 'date_expedition_arrivee', international: true },
  { key: 'agence', label: "Reçu à l'agence d'arrivée", date: 'date_reception_agence' },
  { key: 'remis', label: 'Remis au destinataire', date: 'date_reception_client' },
];

const isInternational = (exp) => {
  const dep = exp?.code_pays_depart || exp?.pays_depart;
  const dest = exp?.code_pays_destination || exp?.pays_destination;
  if (dep && dest) return String(dep).toUpperCase() !== String(dest).toUpperCase();
  return exp?.type_expedition !== 'interville';
};

// -> [{ key, label, date, done }] dans l'ordre, la demande enregistrée en tête.
// Une étape sans date mais suivie d'une étape datée est considérée franchie.
export const getMilestones = (exp) => {
  const international = isInternational(exp);
  const steps = MILESTONES.filter((m) => {
    if (m.international && !international) return false;
    if (m.optional) return Boolean(exp?.[m.date] || exp?.date_prevue_enlevement);
    return true;
  }).map((m) => ({ key: m.key, label: m.label, date: exp?.[m.date] || null }));

  const lastDone = steps.reduce((acc, s, i) => (s.date ? i : acc), -1);
  const list = steps.map((s, i) => ({ ...s, done: i <= lastDone }));

  // Enlèvement planifié mais pas encore fait : on affiche la date prévue.
  const pickup = list.find((s) => s.key === 'enleve');
  if (pickup && !pickup.done && exp?.date_prevue_enlevement) {
    pickup.label = 'Enlèvement prévu';
    pickup.date = exp.date_prevue_enlevement;
    pickup.planned = true;
  }

  return [{ key: 'cree', label: 'Demande enregistrée', date: exp?.created_at || null, done: true }, ...list];
};

// Avancement affiché par les barres de progression (accueil) :
// part des jalons franchis + libellé de la prochaine étape.
export const getProgress = (exp) => {
  const steps = getMilestones(exp);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return { ratio: steps.length ? done / steps.length : 0, nextLabel: next?.label || null };
};

// Statuts clos : plus rien à suivre.
export const CLOSED_STATUSES = ['termined', 'cancelled', 'refused'];

// L'API renvoie la ville soit dans un objet contact imbriqué, soit à plat.
export const villeDepart = (exp) =>
  exp.expediteur?.ville || exp.expediteur_ville || exp.ville_depart || exp.agence?.ville || exp.code_pays_depart || '—';
export const villeDestination = (exp) =>
  exp.destinataire?.ville || exp.destinataire_ville || exp.ville_destination || exp.code_pays_destination || '—';

// Une demande n'est annulable (donc "modifiable" via annuler + recréer) que
// tant que l'agence ne l'a pas traitée physiquement.
export const CANCELABLE_STATUSES = ['en_attente', 'accepted'];
export const isCancelable = (statut) => CANCELABLE_STATUSES.includes(statut);

export const TYPE_LABELS = {
  interville: 'Interville',
  simple: 'Livraison domicile',
  groupage_afrique: 'Groupage Afrique',
  groupage_ca: 'Colis accompagnés',
  groupage_dhd_aerien: 'Groupage DHD aérien',
  groupage_dhd_maritime: 'Groupage DHD maritime',
};

export const getTypeLabel = (type) => TYPE_LABELS[type] || type || '—';

// Familles de filtres proposées dans l'UI de la page Colis.
export const STATUS_FILTERS = [
  { key: 'all', label: 'Tous', match: () => true },
  { key: 'en_attente', label: 'En attente', match: (s) => s === 'en_attente' },
  { key: 'accepted', label: 'Acceptées', match: (s) => s === 'accepted' },
  { key: 'en_cours', label: 'En cours', match: (s) => EN_COURS_STATUSES.includes(s) },
  { key: 'termined', label: 'Terminées', match: (s) => s === 'termined' },
  { key: 'cancelled', label: 'Annulées', match: (s) => s === 'cancelled' || s === 'refused' },
];
