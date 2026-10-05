// Distance et itineraire PAR LA ROUTE entre plusieurs points (distance, duree,
// trace). Plusieurs moteurs routiers sont essayes dans l'ordre ; le premier qui
// repond gagne :
//   1. VITE_ROUTING_URL      — serveur OSRM heberge par TourShop (recommande en prod)
//   2. VITE_ORS_API_KEY      — OpenRouteService (cle gratuite), si configuree
//   3. Valhalla public       — valhalla1.openstreetmap.de (profil moto disponible)
//   4. OSRM public FOSSGIS   — routing.openstreetmap.de
//   5. OSRM demo             — router.project-osrm.org
// Les serveurs publics sont limites en debit et recoivent les coordonnees :
// prevoir un serveur dedie (1) en production.
// Seulement si TOUS echouent : distance a vol d'oiseau, renvoyee avec
// `approx: true` pour que l'ecran l'affiche comme estimation et qu'elle ne
// serve jamais de base de tarification.
// Meme fichier dans client-app et livreur-app (src/services/routingService.js).

const env = import.meta.env;
const OWN_OSRM = (env.VITE_ROUTING_URL || '').replace(/\/+$/, '');
const ORS_KEY = env.VITE_ORS_API_KEY || '';
const TIMEOUT_MS = 7000;
const cache = new Map();

export const isValidPoint = (p) => p != null
  && p.lat !== null && p.lat !== '' && p.lng !== null && p.lng !== ''
  && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));

export const haversineKm = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

// fetch JSON avec delai max, annulable par le signal de l'appelant.
async function fetchJson(url, options = {}, signal) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// Polyline encodee (precision 6) des reponses Valhalla -> [[lat, lng], ...]
function decodePolyline6(str) {
  const coords = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = str.charCodeAt(index) - 63;
      index += 1;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < str.length) {
    lat += next();
    lng += next();
    coords.push([lat / 1e6, lng / 1e6]);
  }
  return coords;
}

// --- Moteurs -----------------------------------------------------------------

const osrm = (name, base) => async (pts, { signal }) => {
  const path = pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const json = await fetchJson(`${base}/route/v1/driving/${path}?overview=full&geometries=geojson`, {}, signal);
  const r = json.routes?.[0];
  if (json.code !== 'Ok' || !r) throw new Error(json.code || 'NoRoute');
  return {
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
    coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    provider: name,
  };
};

const valhalla = async (pts, { signal, vehicle }) => {
  const query = {
    locations: pts.map((p) => ({ lat: p.lat, lon: p.lng })),
    costing: vehicle === 'moto' ? 'motorcycle' : 'auto',
    units: 'kilometers',
  };
  const json = await fetchJson(`https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(query))}`, {}, signal);
  const trip = json.trip;
  if (!trip?.summary || trip.status !== 0) throw new Error('NoRoute');
  return {
    distanceKm: trip.summary.length,
    durationMin: trip.summary.time / 60,
    coords: (trip.legs || []).flatMap((leg) => decodePolyline6(leg.shape)),
    provider: 'valhalla',
  };
};

const openRouteService = async (pts, { signal }) => {
  const json = await fetchJson('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
    method: 'POST',
    headers: { Authorization: ORS_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates: pts.map((p) => [p.lng, p.lat]) }),
  }, signal);
  const f = json.features?.[0];
  if (!f) throw new Error('NoRoute');
  return {
    distanceKm: f.properties.summary.distance / 1000,
    durationMin: f.properties.summary.duration / 60,
    coords: f.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    provider: 'openrouteservice',
  };
};

const PROVIDERS = [
  OWN_OSRM && osrm('tourshop', OWN_OSRM),
  ORS_KEY && openRouteService,
  valhalla,
  osrm('osrm-fossgis', 'https://routing.openstreetmap.de/routed-car'),
  osrm('osrm-demo', 'https://router.project-osrm.org'),
].filter(Boolean);

// Dernier moteur ayant repondu : essaye en premier aux appels suivants.
let preferred = 0;

// points : [{ lat, lng }, ...] (au moins 2 valides)
// options : { signal, vehicle: 'moto' | 'voiture' }
// -> { distanceKm, durationMin|null, coords: [[lat, lng], ...], approx, provider } | null
export async function getRoute(points, { signal, vehicle } = {}) {
  const pts = points.filter(isValidPoint).map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
  if (pts.length < 2) return null;

  const key = `${vehicle || ''}|${pts.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';')}`;
  if (cache.has(key)) return cache.get(key);

  const order = [...PROVIDERS.keys()].sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : a - b));
  for (const i of order) {
    try {
      const r = await PROVIDERS[i](pts, { signal, vehicle });
      if (!(r.distanceKm >= 0) || r.coords.length < 2) throw new Error('Invalid');
      const route = { ...r, approx: false };
      preferred = i;
      cache.set(key, route);
      return route;
    } catch (err) {
      if (signal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
      if (env.DEV) console.warn(`[routing] moteur ${i} indisponible :`, err.message);
    }
  }

  let distanceKm = 0;
  for (let i = 1; i < pts.length; i += 1) distanceKm += haversineKm(pts[i - 1], pts[i]);
  return {
    distanceKm, durationMin: null, coords: pts.map((p) => [p.lat, p.lng]), approx: true, provider: 'vol-oiseau',
  };
}

export const formatDistance = (km) => {
  if (km == null || Number.isNaN(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 100 ? 1 : 0).replace('.', ',')} km`;
};

export const formatEta = (min) => {
  if (min == null) return null;
  if (min < 60) return `${Math.max(1, Math.round(min))} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
};
