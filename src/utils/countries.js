import countriesData from '../data/countries.json';

/**
 * Source de verite unique pour les pays (code ISO 3166-1 alpha-2 + nom FR),
 * copiee a l'identique depuis agence-partenaire / backoffice-app / tourshop-backend
 * pour eviter que les listes de pays divergent d'une app a l'autre.
 */

// Un code ISO 3166-1 alpha-2 se transforme en emoji drapeau en mappant chaque
// lettre sur son "regional indicator symbol" Unicode (A -> U+1F1E6, etc.) —
// aucune image/donnee a charger, rendu nativement par le systeme.
export function getFlagEmoji(code) {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// Options pretes pour un dropdown : {id: code, label: nom, flag: emoji}
export const COUNTRY_OPTIONS = countriesData.map(({ code, name }) => ({ id: code, label: name, flag: getFlagEmoji(code) }));

const BY_CODE = new Map(countriesData.map((c) => [c.code, c.name]));

export function getCountryName(code) {
  if (!code) return '';
  return BY_CODE.get(code.toUpperCase()) || code;
}

export function isValidCountryCode(code) {
  return Boolean(code) && BY_CODE.has(code.toUpperCase());
}

export default countriesData;
