import { useEffect, useState } from 'react';
import marketplaceService from '../services/marketplaceService';
import { getRoute, isValidPoint } from '../services/routingService';

// Les 3 tarifs de livraison marketplace avant de choisir
// (GET /marketplace/acheteur/tarifs-livraison, MARKETPLACE_LIVRAISON_3_MODES.md).
// La distance est calculee cote app (route OSM, sinon vol d'oiseau) : c'est elle
// qui sert a trouver la tranche, et elle est renvoyee au choix du mode.
//
// -> { status: 'idle'|'loading'|'ready'|'error'|'incomplete', tarifs, distanceKm }
//    `incomplete` : il manque la commune de depart ou d'arrivee.
export default function useDeliveryQuotes({
  vendeurId, communeDepartId, communeArriveeId, from, to, enabled = true,
}) {
  const [state, setState] = useState({ status: 'idle', tarifs: null, distanceKm: null });
  const fromKey = isValidPoint(from) ? `${from.lat},${from.lng}` : '';
  const toKey = isValidPoint(to) ? `${to.lat},${to.lng}` : '';

  useEffect(() => {
    if (!enabled || !vendeurId) {
      setState({ status: 'idle', tarifs: null, distanceKm: null });
      return undefined;
    }
    if (!communeDepartId || !communeArriveeId) {
      setState({ status: 'incomplete', tarifs: null, distanceKm: null });
      return undefined;
    }
    const controller = new AbortController();
    let alive = true;
    setState((s) => ({ ...s, status: 'loading' }));

    (async () => {
      let distanceKm = null;
      if (fromKey && toKey) {
        try {
          const route = await getRoute([from, to], { signal: controller.signal, vehicle: 'moto' });
          if (route) distanceKm = Math.round(route.distanceKm * 10) / 10;
        } catch {
          // distance indisponible : le serveur retombe sur les GPS stockes
        }
      }
      try {
        const tarifs = await marketplaceService.tarifsLivraison({
          vendeurId, communeDepartId, communeArriveeId, distanceKm,
        });
        if (alive) setState({ status: 'ready', tarifs, distanceKm });
      } catch {
        if (alive) setState({ status: 'error', tarifs: null, distanceKm });
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
    // from/to suivis via leurs cles stables
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, vendeurId, communeDepartId, communeArriveeId, fromKey, toKey]);

  return state;
}
