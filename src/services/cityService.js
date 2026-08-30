import countryApiNames from '../data/countryApiNames.json';

// Recherche de villes via l'API publique CountriesNow (pas de cle requise).
// Certains pays (ex: RD Congo, Palestine, Soudan du Sud) n'y sont pas
// references sous un nom qui fonctionne -> hasCitySearch() le signale pour
// que l'UI retombe sur une simple saisie libre plutot que de bloquer.
const API_URL = 'https://countriesnow.space/api/v0.1/countries/cities/q';

export function hasCitySearch(codePays) {
  return Boolean(codePays && countryApiNames[codePays.toUpperCase()]);
}

const cache = new Map(); // code_pays -> string[] (only successful fetches are cached)
const TIMEOUT_MS = 8000;

const listCities = async (codePays) => {
  const code = codePays?.toUpperCase();
  const countryName = code && countryApiNames[code];
  if (!countryName) return [];
  if (cache.has(code)) return cache.get(code);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}?country=${encodeURIComponent(countryName)}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.msg || 'country not found');
    const cities = data.data ?? [];
    cache.set(code, cities);
    return cities;
  } finally {
    clearTimeout(timeout);
  }
};

const cityService = { listCities, hasCitySearch };

export default cityService;
