// ISO 3166-1 alpha-2 codes of the 54 African UN member states — used to know
// whether the devis groupage endpoint will route via "Groupage Afrique"
// (no ville_destination needed) or via DHD/CA (ville_destination required).
// Mirrors the routing table documented in api-devis-client.md.
const AFRICAN_COUNTRY_CODES = new Set([
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD',
  'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET',
  'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG',
  'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW',
  'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG',
  'TN', 'UG', 'ZM', 'ZW',
]);

export function isAfricanCountry(code) {
  return Boolean(code) && AFRICAN_COUNTRY_CODES.has(code.toUpperCase());
}
