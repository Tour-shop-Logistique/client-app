// Recherche de lieux (adresse, quartier, repère…) -> coordonnées.
// Nominatim (OpenStreetMap), sans clé API, comme les fonds de carte et le
// routage. Le serveur public est limité à ~1 requête/s : l'appelant doit
// temporiser la saisie. VITE_GEOCODING_URL permet de pointer vers une
// instance Nominatim hébergée par TourShop (recommandé en production).

const BASE = (import.meta.env.VITE_GEOCODING_URL || 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
const TIMEOUT_MS = 7000;
const cache = new Map();

// query : texte libre
// options : { signal, countryCode: 'ci', near: { lat, lng } (priorise les résultats proches) }
// -> [{ id, label, detail, lat, lng }]
export async function searchPlaces(query, { signal, countryCode, near } = {}) {
  const q = query.trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({
    q, format: 'jsonv2', limit: '6', addressdetails: '0', 'accept-language': 'fr',
  });
  if (countryCode) params.set('countrycodes', countryCode.toLowerCase());
  if (near) {
    // Zone d'environ 50 km autour de l'agence : priorité, pas exclusion.
    const d = 0.5;
    params.set('viewbox', [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(','));
  }

  const url = `${BASE}/search?${params}`;
  if (cache.has(url)) return cache.get(url);

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const places = json.map((p) => {
      const [label, ...rest] = (p.display_name || '').split(', ');
      return {
        id: p.place_id,
        label: p.name || label,
        detail: rest.join(', '),
        lat: Number(p.lat),
        lng: Number(p.lon),
      };
    }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    cache.set(url, places);
    return places;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
