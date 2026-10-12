import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import expeditionService from '../services/expeditionService';

// Communes actives du pays de l'utilisateur, configurees par le backoffice
// (GET /communes?code_pays=). Pays du compte, sinon pays choisi dans l'app.
// Cache memoire par pays : la liste change rarement.
const cache = new Map();

export default function useCommunes() {
  const userCountry = useSelector((s) => s.auth.user?.code_pays);
  const appCountry = useSelector((s) => s.country?.code);
  const code = (userCountry || appCountry || '').toUpperCase();
  const [state, setState] = useState(() => ({
    communes: cache.get(code) ?? [],
    status: !code ? 'none' : cache.has(code) ? 'idle' : 'loading',
  }));

  useEffect(() => {
    if (!code) {
      setState({ communes: [], status: 'none' });
      return undefined;
    }
    if (cache.has(code)) {
      setState({ communes: cache.get(code), status: 'idle' });
      return undefined;
    }
    let cancelled = false;
    setState({ communes: [], status: 'loading' });
    expeditionService
      .listCommunes(code)
      .then((d) => {
        const list = d.communes ?? [];
        cache.set(code, list);
        if (!cancelled) setState({ communes: list, status: 'idle' });
      })
      .catch(() => !cancelled && setState({ communes: [], status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [code]);

  return state;
}
