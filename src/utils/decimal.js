// Saisie décimale à la française : on affiche « 2,5 », on stocke « 2.5 »
// (chaîne, comme le reste des formulaires ; Number() la lit directement).

export const decimalDisplay = (v) => String(v ?? '').replace('.', ',');

// Garde chiffres et un seul séparateur décimal ; la virgule devient un point.
export const decimalClean = (raw) => {
  const clean = String(raw).replace(',', '.').replace(/[^0-9.]/g, '');
  const [int, ...dec] = clean.split('.');
  return dec.length ? `${int}.${dec.join('')}` : int;
};

// Poids lisible : « 2,5 kg ».
export const fmtKg = (v) => `${(Number(v) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`;
