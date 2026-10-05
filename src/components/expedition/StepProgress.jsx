import { Check } from 'lucide-react';

// Étapes en pastilles reliées (maquette « Nouvel envoi »).
// `onStepClick` + `maxStepReached` enable a clickable trail so users can jump
// back to any section they already completed, not just one step at a time.
// Omit both to keep the static trail (used where the caller doesn't support
// jumping, e.g. IntervilleFormPage).
export default function StepProgress({ step, total, labels, onStepClick, maxStepReached }) {
  const reachable = maxStepReached ?? step;
  const clickable = Boolean(onStepClick && labels);
  // Au-delà de 4 étapes, les libellés ne tiennent plus sous les pastilles :
  // seul celui de l'étape en cours est affiché, sous la frise.
  const inlineCaptions = total <= 4;

  return (
    <div className="mb-5">
      <ol className="flex items-start">
        {Array.from({ length: total }).map((_, i) => {
          const stepNumber = i + 1;
          const isCurrent = stepNumber === step;
          const isPast = stepNumber < step;
          const canJump = clickable && stepNumber <= reachable && !isCurrent;
          const label = labels?.[i];

          const dot = (
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                isPast
                  ? 'bg-primary-600 text-white'
                  : isCurrent
                    ? 'bg-white text-primary-600 ring-2 ring-primary-600 ring-offset-0 shadow-[0_0_0_5px_theme(colors.primary.100)]'
                    : 'bg-surface-100 text-surface-400'
              }`}
            >
              {isPast ? <Check size={15} strokeWidth={3} /> : stepNumber}
            </span>
          );
          const caption = label && inlineCaptions && (
            <span
              className={`line-clamp-2 max-w-[4.5rem] text-center text-[11px] leading-tight ${
                isCurrent ? 'font-bold text-surface-900' : isPast ? 'font-semibold text-primary-700' : 'font-medium text-surface-500'
              }`}
            >
              {label}
            </span>
          );

          return (
            <li key={i} className={`flex items-start ${i < total - 1 ? 'flex-1' : ''}`} aria-current={isCurrent ? 'step' : undefined}>
              {canJump ? (
                <button
                  type="button"
                  onClick={() => onStepClick(stepNumber)}
                  aria-label={inlineCaptions ? undefined : `Revenir à l'étape ${stepNumber}${label ? ` : ${label}` : ''}`}
                  className="flex shrink-0 flex-col items-center gap-1.5"
                >
                  {dot}
                  {caption}
                </button>
              ) : (
                <span className="flex shrink-0 flex-col items-center gap-1.5">
                  {dot}
                  {caption}
                </span>
              )}
              {i < total - 1 && (
                <span
                  className={`mx-1 mt-[15px] h-[3px] flex-1 rounded-full ${isPast ? 'bg-primary-600' : 'bg-surface-200'}`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
      {labels?.[step - 1] && (
        <p className={inlineCaptions ? 'sr-only' : 'mt-2.5 text-xs font-semibold text-surface-500'}>
          Étape {step} sur {total} · <span className="text-surface-900">{labels[step - 1]}</span>
        </p>
      )}
    </div>
  );
}
