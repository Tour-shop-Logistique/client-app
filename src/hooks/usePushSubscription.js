import { useCallback, useEffect, useState } from 'react';
import pushService, { isPushSupported } from '../services/pushService';

// Etat de l'abonnement Web Push de cet appareil. `ready` passe a true une fois
// l'abonnement courant lu (evite d'afficher "desactive" pendant la lecture).
// `permission` : 'default' | 'granted' | 'denied' | 'unsupported' (la bannière
// d'invitation n'apparait que tant que la permission est 'default').
export default function usePushSubscription() {
  const supported = isPushSupported();
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(!supported);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState(() => pushService.getPermission());

  useEffect(() => {
    if (!supported) return;
    pushService.getCurrentSubscription()
      .then((sub) => setEnabled(Boolean(sub)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [supported]);

  const toggle = useCallback(async () => {
    setLoading(true);
    try {
      if (enabled) {
        await pushService.unsubscribe();
        setEnabled(false);
        return { ok: true, enabled: false };
      }
      await pushService.subscribe();
      setEnabled(true);
      return { ok: true, enabled: true };
    } catch (err) {
      return { ok: false, message: err?.response?.data?.message || err.message };
    } finally {
      // Le choix de l'utilisateur (autoriser / refuser) change la permission.
      setPermission(pushService.getPermission());
      setLoading(false);
    }
  }, [enabled]);

  return { supported, ready, enabled, loading, permission, toggle };
}
