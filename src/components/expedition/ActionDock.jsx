import useTyping from '../../hooks/useTyping';

// Barre d'action collée en bas de l'écran, juste au-dessus de la navigation
// principale : l'action de l'étape reste sous le pouce quel que soit le défilement.
// Placée en dernier dans le contenu de la page (position sticky).
// Pendant une saisie, la navigation se replie : la barre descend à sa place,
// juste au-dessus du clavier.
export default function ActionDock({ children }) {
  const typing = useTyping();
  return (
    <div
      className={`sticky z-20 mt-5 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.35)] ring-1 ring-surface-100 transition-[bottom] duration-200 ${
        typing
          ? 'bottom-[max(0.75rem,env(safe-area-inset-bottom))]'
          : 'bottom-[calc(theme(spacing.bottom-nav)+max(0.75rem,env(safe-area-inset-bottom))+0.75rem)]'
      }`}
    >
      {children}
    </div>
  );
}

// Montant affiché à gauche du bouton principal, avec état de calcul.
export function DockTotal({ label, amount, status = 'idle' }) {
  return (
    <div className="min-w-0 shrink-0" aria-live="polite">
      <p className="text-caption text-surface-500">{label}</p>
      {status === 'loading' ? (
        <span className="skeleton mt-1 block h-5 w-24" aria-label="Calcul du tarif en cours" />
      ) : (
        <p className={`whitespace-nowrap font-heading text-base font-bold ${amount ? 'text-primary-700' : 'text-surface-400'}`}>
          {amount || '—'}
        </p>
      )}
    </div>
  );
}
