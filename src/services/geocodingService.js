// Recherche de lieux (adresse, quartier, commerce, repère…) -> coordonnées.
//
// Deux moteurs OpenStreetMap, sans clé API, interrogés ensemble :
//   1. Photon (komoot) — pensé pour la saisie : tolère les requêtes à plusieurs
//      mots ("Angré 8e tranche", "pharmacie Saint Gabriel"), renvoie quartiers,
//      commerces et repères, et privilégie ce qui est proche de l'agence
//      (biais de position). Principal.
//   2. Nominatim — complète quand Photon renvoie peu de résultats (adresses,
//      lieux nommés que Photon ne connaît pas). Limité à ~1 requête/s : appelé
//      seulement en complément, après la saisie temporisée.
// Les résultats sont fusionnés et dédoublonnés (même lieu à ~100 m près).
//
// Variables facultatives pour pointer vers des instances hébergées par TourShop
// (recommandé en production, sans limite de débit) :
//   VITE_PHOTON_URL     ex. https://photon.exemple.com
//   VITE_GEOCODING_URL  instance Nominatim

const env = import.meta.env;
const PHOTON = (env.VITE_PHOTON_URL || 'https://photon.komoot.io').replace(/\/+$/, '');
const NOMINATIM = (env.VITE_GEOCODING_URL || 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
const TIMEOUT_MS = 7000;
const MAX_RESULTS = 8;
const cache = new Map();

// Emprise approximative (ouest,sud,est,nord) : limite Photon au pays de départ.
const COUNTRY_BBOX = {
  CI: '-8.7,4.3,-2.4,10.8',
  SN: '-17.6,12.3,-11.3,16.7',
  CM: '8.4,1.6,16.2,13.1',
  BF: '-5.6,9.4,2.5,15.1',
  ML: '-12.3,10.1,4.3,25.0',
  TG: '-0.2,6.0,1.9,11.2',
  BJ: '0.7,6.2,3.9,12.5',
  GN: '-15.1,7.1,-7.6,12.7',
  GA: '8.6,-4.0,14.6,2.4',
};

// fetch JSON avec délai max, annulable par le signal de l'appelant.
async function fetchJson(url, signal, headers) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

const uniq = (list) => list.filter((v, i) => v && list.indexOf(v) === i);

async function searchPhoton(q, { signal, countryCode, near }) {
  const params = new URLSearchParams({ q, limit: '12', lang: 'fr' });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lng));
    params.set('location_bias_scale', '0.4'); // fort privilège aux lieux proches
  }
  const bbox = COUNTRY_BBOX[String(countryCode || '').toUpperCase()];
  if (bbox) params.set('bbox', bbox);

  const json = await fetchJson(`${PHOTON}/api/?${params}`, signal);
  const code = String(countryCode || '').toUpperCase();
  return (json.features || [])
    .filter((f) => !code || String(f.properties?.countrycode || '').toUpperCase() === code)
    .map((f) => {
      const pr = f.properties || {};
      const street = [pr.housenumber, pr.street].filter(Boolean).join(' ');
      const label = pr.name || street || pr.district || pr.locality || pr.city;
      const detail = uniq([
        pr.name ? street : '',
        pr.district && pr.district !== label ? pr.district : '',
        pr.locality && pr.locality !== label ? pr.locality : '',
        pr.city && pr.city !== label ? pr.city : '',
        pr.state && pr.state !== pr.city ? pr.state : '',
      ]).join(', ');
      const [lng, lat] = f.geometry?.coordinates || [];
      return {
        id: `p-${pr.osm_type}${pr.osm_id}`, label, detail, lat: Number(lat), lng: Number(lng),
      };
    });
}

async function searchNominatim(q, { signal, countryCode, near }) {
  const params = new URLSearchParams({
    q, format: 'jsonv2', limit: '6', addressdetails: '0', 'accept-language': 'fr',
  });
  if (countryCode) params.set('countrycodes', countryCode.toLowerCase());
  if (near) {
    const d = 0.5; // ~50 km autour de l'agence : priorité, pas exclusion
    params.set('viewbox', [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(','));
  }
  const json = await fetchJson(`${NOMINATIM}/search?${params}`, signal);
  return json.map((p) => {
    const [label, ...rest] = (p.display_name || '').split(', ');
    return {
      id: `n-${p.place_id}`, label: p.name || label, detail: rest.slice(0, 3).join(', '), lat: Number(p.lat), lng: Number(p.lon),
    };
  });
}

const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Fusionne en gardant l'ordre de pertinence ; un lieu déjà présent (même nom, ou
// à moins de ~100 m avec un nom voisin) n'est pas répété.
function merge(lists) {
  const out = [];
  lists.flat().forEach((p) => {
    if (!p.label || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
    const dup = out.some((o) => (
      (norm(o.label) === norm(p.label) && Math.abs(o.lat - p.lat) < 0.002 && Math.abs(o.lng - p.lng) < 0.002)
      || (Math.abs(o.lat - p.lat) < 0.0008 && Math.abs(o.lng - p.lng) < 0.0008
        && (norm(o.label).includes(norm(p.label)) || norm(p.label).includes(norm(o.label))))
    ));
    if (!dup) out.push(p);
  });
  return out.slice(0, MAX_RESULTS);
}

// query : texte libre
// options : { signal, countryCode: 'CI', near: { lat, lng } (priorise les résultats proches) }
// -> [{ id, label, detail, lat, lng }]
export async function searchPlaces(query, { signal, countryCode, near } = {}) {
  const q = query.trim();
  if (q.length < 3) return [];

  const key = `${q.toLowerCase()}|${countryCode || ''}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ''}`;
  if (cache.has(key)) return cache.get(key);

  const opts = { signal, countryCode, near };
  let primary = [];
  let primaryFailed = false;
  try {
    primary = await searchPhoton(q, opts);
  } catch (err) {
    if (signal?.aborted) throw err;
    primaryFailed = true;
  }

  // Complément Nominatim si Photon renvoie peu (ou a échoué).
  let extra = [];
  if (primary.length < 5) {
    try {
      extra = await searchNominatim(q, opts);
    } catch (err) {
      if (signal?.aborted) throw err;
      if (primaryFailed) throw err; // aucun moteur n'a répondu
    }
  }

  const places = merge([primary, extra]);
  cache.set(key, places);
  return places;
}

// ---------------------------------------------------------------------------
// Suggestions d'adresse postale (code postal + ville + rue) au fil de la saisie.
// Mêmes moteurs OSM que ci-dessus.
// Résultat : [{ id, postcode, city, state, street, label, detail }]
// `label` = « 75011 Paris », `detail` = rue / région.
// ---------------------------------------------------------------------------

const postalCache = new Map();
const compact = (v) => norm(v).replace(/[\s-]/g, '');
const looksLikePostal = (q) => /\d/.test(q) && /^[A-Za-z]{0,3}[\s-]?\d[\w\s-]*$/.test(q.trim());

async function postalPhoton(q, { signal, countryCode }) {
  const params = new URLSearchParams({ q, limit: '15', lang: 'fr' });
  const json = await fetchJson(`${PHOTON}/api/?${params}`, signal);
  const code = String(countryCode || '').toUpperCase();
  return (json.features || [])
    .filter((f) => !code || String(f.properties?.countrycode || '').toUpperCase() === code)
    .map((f) => {
      const pr = f.properties || {};
      return {
        postcode: pr.postcode || '',
        city: pr.city || pr.locality || pr.district || (pr.type === 'city' ? pr.name : '') || '',
        state: pr.state || '',
        street: [pr.housenumber, pr.street || (pr.type === 'street' ? pr.name : '')].filter(Boolean).join(' '),
      };
    });
}

async function postalNominatim(q, { signal, countryCode }) {
  const params = new URLSearchParams({
    format: 'jsonv2', limit: '10', addressdetails: '1', 'accept-language': 'fr',
  });
  if (looksLikePostal(q)) params.set('postalcode', q);
  else params.set('q', q);
  if (countryCode) params.set('countrycodes', countryCode.toLowerCase());
  const json = await fetchJson(`${NOMINATIM}/search?${params}`, signal);
  return json.map((p) => {
    const a = p.address || {};
    return {
      postcode: a.postcode || '',
      city: a.city || a.town || a.village || a.municipality || a.suburb || '',
      state: a.state || a.region || '',
      street: [a.house_number, a.road].filter(Boolean).join(' '),
    };
  });
}

// query : début de code postal ou d'adresse (2 caractères minimum).
// options : { signal, countryCode: 'FR' } — pays de destination.
export async function searchPostalAddresses(query, { signal, countryCode } = {}) {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = `${q.toLowerCase()}|${countryCode || ''}`;
  if (postalCache.has(key)) return postalCache.get(key);

  const opts = { signal, countryCode };
  const numeric = looksLikePostal(q);
  let list = [];
  let failed = false;
  try {
    list = await postalPhoton(q, opts);
  } catch (err) {
    if (signal?.aborted) throw err;
    failed = true;
  }
  if (list.filter((r) => r.postcode).length < 4) {
    try {
      list = list.concat(await postalNominatim(q, opts));
    } catch (err) {
      if (signal?.aborted) throw err;
      if (failed) throw err; // aucun moteur n'a répondu
    }
  }

  const seen = new Set();
  const out = [];
  list.forEach((r) => {
    if (!r.postcode) return;
    // Saisie de type code postal : on ne garde que les codes qui la contiennent.
    if (numeric && !compact(r.postcode).includes(compact(q))) return;
    const id = `${r.postcode}|${norm(r.city)}|${norm(r.street)}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      ...r,
      label: [r.postcode, r.city].filter(Boolean).join(' '),
      detail: [r.street, r.state].filter(Boolean).join(', '),
    });
  });
  const result = out.slice(0, MAX_RESULTS);
  postalCache.set(key, result);
  return result;
}
