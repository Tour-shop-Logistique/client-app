// Devise des montants d'une expédition = celle du pays de DÉPART
// (CHANGEMENTS_APPS_CLIENT_LIVREUR.md §1 : `devise_origine`). Chaque backoffice
// (un par pays) a sa devise, mais l'API ne la renvoie qu'une fois l'expédition
// créée. Avant l'envoi (devis, tarif d'enlèvement), l'app la déduit du pays de
// départ choisi, qui peut différer du pays du compte (sélecteur de pays des
// formulaires d'expédition).

const group = (code, countries) => Object.fromEntries(countries.split(' ').map((c) => [c, code]));

const CURRENCY_BY_COUNTRY = {
  // Franc CFA UEMOA / CEMAC
  ...group('XOF', 'BJ BF CI GW ML NE SN TG'),
  ...group('XAF', 'CM CF TD CG GA GQ'),
  // Euro
  ...group('EUR', 'FR DE ES IT PT BE NL LU IE AT FI GR SK SI EE LV LT MT CY HR MC SM VA AD'),
  // Afrique
  GN: 'GNF', MA: 'MAD', DZ: 'DZD', TN: 'TND', EG: 'EGP', NG: 'NGN', GH: 'GHS',
  CD: 'CDF', RW: 'RWF', BI: 'BIF', KM: 'KMF', MG: 'MGA', MR: 'MRU', LR: 'LRD',
  SL: 'SLE', GM: 'GMD', CV: 'CVE', ST: 'STN', DJ: 'DJF', ET: 'ETB', KE: 'KES',
  TZ: 'TZS', UG: 'UGX', ZA: 'ZAR', AO: 'AOA', MZ: 'MZN', ZM: 'ZMW', ZW: 'USD',
  BW: 'BWP', NA: 'NAD', MU: 'MUR', SC: 'SCR', LY: 'LYD', SD: 'SDG', SS: 'SSP',
  SO: 'SOS', ER: 'ERN', LS: 'LSL', SZ: 'SZL', MW: 'MWK',
  // Europe hors euro
  GB: 'GBP', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK',
  HU: 'HUF', RO: 'RON', BG: 'BGN', RU: 'RUB', TR: 'TRY', UA: 'UAH', IS: 'ISK',
  // Amériques
  US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP',
  PE: 'PEN', HT: 'HTG',
  // Asie / Moyen-Orient / Océanie
  CN: 'CNY', JP: 'JPY', IN: 'INR', AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD',
  LB: 'LBP', KR: 'KRW', SG: 'SGD', HK: 'HKD', TH: 'THB', VN: 'VND', ID: 'IDR',
  MY: 'MYR', PH: 'PHP', PK: 'PKR', IL: 'ILS', AU: 'AUD', NZ: 'NZD',
};

// Devise d'une course (enlèvement / livraison) : `devise` de la mission ou de
// l'expédition si l'API la fournit, sinon celle du pays concerné.

// Devise des montants d'une expédition au départ de `countryCode`.
// - pays du compte : `user.devise`, fournie par le backoffice (fait foi) ;
// - autre pays : table ci-dessus ;
// - inconnu : undefined -> devise par défaut de l'application.
export function departureCurrency(countryCode, user) {
  const code = String(countryCode || '').toUpperCase();
  if (user?.devise && String(user.code_pays || '').toUpperCase() === code) return String(user.devise).toUpperCase();
  return CURRENCY_BY_COUNTRY[code];
}
