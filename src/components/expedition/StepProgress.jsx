// `onStepClick` + `maxStepReached` enable a clickable trail so users can jump
// back to any section they already completed, not just one step at a time.
// Omit both to keep the original static single-line label (used where the
// caller doesn't support jumping, e.g. IntervilleFormPage).
export default function StepProgress({ step, total, labels, onStepClick, maxStepReached }) {
  const reachable = maxStepReached ?? step;

  return (
    <div className="mb-5">
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-primary-600' : 'bg-surface-200'}`}
          />
        ))}
      </div>

      {onStepClick && labels ? (
        <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto">
          {labels.map((label, i) => {
            const stepNumber = i + 1;
            const isCurrent = stepNumber === step;
            const isPast = stepNumber < step;
            const isReachable = stepNumber <= reachable;
            const chipClass = `shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              isCurrent
                ? 'bg-primary-600 text-white'
                : isPast
                  ? 'bg-primary-50 text-primary-700'
                  : 'bg-surface-100 text-surface-400'
            }`;
            return isReachable && !isCurrent ? (
              <button key={i} type="button" onClick={() => onStepClick(stepNumber)} className={chipClass}>
                {stepNumber}. {label}
              </button>
            ) : (
              <span key={i} className={chipClass}>
                {stepNumber}. {label}
              </span>
            );
          })}
        </div>
      ) : (
        labels?.[step - 1] && (
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-surface-400">
            Etape {step}/{total} — {labels[step - 1]}
          </p>
        )
      )}
    </div>
  );
}
