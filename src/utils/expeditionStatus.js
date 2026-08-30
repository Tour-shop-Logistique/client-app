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

const EN_COURS_META = { label: 'En cours', className: 'bg-primary-50 text-primary-700' };

export const getStatutMeta = (statut) => {
  if (STATUT_META[statut]) return STATUT_META[statut];
  if (EN_COURS_STATUSES.includes(statut)) return EN_COURS_META;
  return { label: statut || 'Inconnu', className: 'bg-surface-100 text-surface-600' };
};

// Une demande n'est annulable (donc "modifiable" via annuler + recréer) que
// tant que l'agence ne l'a pas traitée physiquement.
export const CANCELABLE_STATUSES = ['en_attente', 'accepted'];
export const isCancelable = (statut) => CANCELABLE_STATUSES.includes(statut);

export const TYPE_LABELS = {
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
