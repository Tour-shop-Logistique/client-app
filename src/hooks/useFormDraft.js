import { useCallback, useEffect, useRef, useState } from 'react';
import { loadValue, saveValue } from '../utils/draftStore';

// Brouillon d'un formulaire a plusieurs etats, conserve dans IndexedDB (photos
// comprises) pour survivre a un rechargement de l'onglet.
// - `data` : instantane memoise (useMemo) de ce qu'il faut conserver.
// - `onRestore(saved)` : appele une fois au montage si un brouillon existe ;
//   retourner false si le brouillon est ignore (pas de bandeau).
// - `empty` : rien d'utile saisi -> le brouillon est supprime, pas sauve.
// Retourne { restored, clear } : `clear()` a appeler apres envoi reussi.
export default function useFormDraft(key, data, onRestore, empty) {
  const [restored, setRestored] = useState(false);
  const ready = useRef(false);
  const restoreRef = useRef(onRestore);

  useEffect(() => {
    restoreRef.current = onRestore;
  });

  useEffect(() => {
    let cancelled = false;
    loadValue(key).then((saved) => {
      if (cancelled) return;
      if (saved && restoreRef.current(saved) !== false) setRestored(true);
      ready.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!ready.current) return undefined;
    const timer = setTimeout(() => saveValue(key, empty ? null : data), 400);
    return () => clearTimeout(timer);
  }, [key, data, empty]);

  const clear = useCallback(() => {
    setRestored(false);
    saveValue(key, null);
  }, [key]);

  return { restored, clear };
}
