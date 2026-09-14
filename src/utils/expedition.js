// Destination-country availability, per api-devis-client.md
// (GET /api/expedition/client/pays-disponibles): each entry carries a boolean
// per expedition type telling whether at least one active tariff exists toward
// that country from the departure backoffice.

export const DESTINATION_TYPES = [
  { key: 'ld', label: 'LD', modes: ['livraison_domicile'] },
  { key: 'groupage_afrique', label: 'Groupage Afrique', modes: ['recuperation_agence'] },
  { key: 'groupage_ca', label: 'CA', modes: ['recuperation_agence'] },
  { key: 'groupage_dhd_aerien', label: 'DHD Aerien', modes: ['recuperation_agence'] },
  { key: 'groupage_dhd_maritime', label: 'DHD Maritime', modes: ['recuperation_agence'] },
];

// True if the country has at least one active tariff of a type the given mode
// uses. With no mode, true if it is tariffed for anything at all.
export function isDestinationCompatible(entry, mode) {
  if (!entry) return false;
  const types = mode ? DESTINATION_TYPES.filter((t) => t.modes.includes(mode)) : DESTINATION_TYPES;
  return types.some((t) => entry[t.key]);
}

// Labels of the available types for an entry, optionally narrowed to a mode.
export function destinationBadges(entry, mode) {
  if (!entry) return [];
  return DESTINATION_TYPES.filter((t) => entry[t.key] && (!mode || t.modes.includes(mode))).map((t) => t.label);
}
