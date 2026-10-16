import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import expeditionService from '../services/expeditionService';

// Formats de colis du pays. `code_pays` est toujours envoyé : la route est
// publique, le backend n'y lit pas toujours le token (422 sans `code_pays` même
// connecté). Connecté, on envoie le pays du compte (le backend le fait primer).
export default function useColisFormats(retryKey = 0) {
  const selectedCode = useSelector((s) => s.country.code);
  const userCode = useSelector((s) => s.auth.user?.code_pays);
  const countryCode = userCode || selectedCode;
  const [formats, setFormats] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | error

  useEffect(() => {
    if (!countryCode) return undefined;
    let cancelled = false;
    setStatus('loading');
    expeditionService
      .getColisFormats(countryCode)
      .then((d) => {
        if (cancelled) return;
        setFormats(d?.formats ?? []);
        setStatus('idle');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [countryCode, retryKey]);

  return { formats, status };
}
