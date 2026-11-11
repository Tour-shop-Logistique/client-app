import { useCallback, useRef, useState } from 'react';
import BottomSheet from '../components/common/BottomSheet';

// Remplace window.confirm par une feuille cohérente avec l'app.
//   const [confirm, confirmDialog] = useConfirm();
//   if (!(await confirm({ title: 'Supprimer ?', message: '…', confirmLabel: 'Supprimer', danger: true }))) return;
//   … puis afficher {confirmDialog} dans le JSX.
export default function useConfirm() {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setState(options);
  }), []);

  const close = (answer) => {
    resolver.current?.(answer);
    resolver.current = null;
    setState(null);
  };

  const dialog = (
    <BottomSheet open={Boolean(state)} onClose={() => close(false)} title={state?.title || 'Confirmation'}>
      {state?.message && <p className="mb-4 text-sm text-surface-600">{state.message}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary h-12 flex-1" onClick={() => close(false)}>
          {state?.cancelLabel || 'Annuler'}
        </button>
        <button
          type="button"
          className={`h-12 flex-1 ${state?.danger ? 'btn-primary !bg-red-600 hover:!bg-red-700' : 'btn-primary'}`}
          onClick={() => close(true)}
        >
          {state?.confirmLabel || 'Confirmer'}
        </button>
      </div>
    </BottomSheet>
  );

  return [confirm, dialog];
}
