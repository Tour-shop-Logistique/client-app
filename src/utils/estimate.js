// Placeholder pricing so the Interville flow is usable before the backoffice
// tarification API (cahier 7.1: tarifs par ville/taille, commissions agences)
// is wired up. expeditionService.estimateInterville should replace this once
// the backend endpoint is available — see fallback usage in the form.
const SIZE_MULTIPLIER = { S: 1, M: 1.5, L: 2.2, XL: 3 };

export function estimateIntervillePlaceholder({ poids = 1, taille = 'M' }) {
  const base = 1500;
  const perKg = 400;
  const total = Math.round((base + perKg * Number(poids || 1)) * (SIZE_MULTIPLIER[taille] || 1));
  return { montant: total, devise: 'FCFA', estimation: true };
}
