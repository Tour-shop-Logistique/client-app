import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { registerSheet } from '../../utils/sheetStack';

export default function BottomSheet({ open, onClose, title, children }) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    // Empilée : le bouton retour ferme la feuille du dessus avant tout (useExitGuard).
    const unregister = registerSheet(() => onCloseRef.current?.());
    return () => {
      document.body.style.overflow = '';
      unregister();
    };
  }, [open]);

  const target = document.getElementById('sheet-root');
  if (!open || !target) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-surface-900/40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 pb-safe-bottom animate-sheet-up max-h-[90dvh] overflow-y-auto">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-surface-200" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-surface-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-surface-500 hover:bg-surface-100"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    target
  );
}
