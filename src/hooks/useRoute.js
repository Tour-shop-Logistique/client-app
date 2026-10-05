import { useEffect, useState } from 'react';
import { getRoute, isValidPoint } from '../services/routingService';

const RETRY_MS = 20000;
const MAX_RETRIES = 3;

// Itineraire routier entre `points` ([{ lat, lng }]), recalcule quand ils changent.
// `precision` (decimales) arrondit les coordonnees avant comparaison : 3 ≈ 110 m,
// pour ne pas relancer un calcul a chaque petit deplacement d'une position GPS.
// Si aucun moteur routier n'a repondu (resultat `approx`, vol d'oiseau), un
// nouveau calcul est tente toutes les 20 s, 3 fois au plus.
export default function useRoute(points, {
  enabled = true, precision = 5, debounceMs = 400, vehicle,
} = {}) {
  const key = JSON.stringify(points.map((p) => (isValidPoint(p)
    ? [Number(Number(p.lat).toFixed(precision)), Number(Number(p.lng).toFixed(precision))]
    : null)));
  const [state, setState] = useState({ status: 'idle', route: null });
  const [retry, setRetry] = useState({ key: null, count: 0 });
  const attempt = retry.key === key ? retry.count : 0;

  useEffect(() => {
    const pts = JSON.parse(key).filter(Boolean);
    if (!enabled || pts.length < 2) {
      setState({ status: 'idle', route: null });
      return undefined;
    }
    const controller = new AbortController();
    let retryTimer;
    setState((s) => ({ ...s, status: 'loading' }));
    const timer = setTimeout(() => {
      getRoute(pts.map(([lat, lng]) => ({ lat, lng })), { signal: controller.signal, vehicle })
        .then((route) => {
          setState({ status: 'idle', route });
          if (route?.approx && attempt < MAX_RETRIES) {
            retryTimer = setTimeout(() => setRetry({ key, count: attempt + 1 }), RETRY_MS);
          }
        })
        .catch((err) => {
          if (err.name !== 'AbortError') setState({ status: 'error', route: null });
        });
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      clearTimeout(retryTimer);
      controller.abort();
    };
  }, [key, enabled, debounceMs, vehicle, attempt]);

  return state;
}
