// Barre d'étapes segmentée, pensée pour le mobile : un segment par étape avec
// son libellé dessous, zone tactile de 44 px. Les étapes déjà atteintes sont
// cliquables pour revenir en arrière sans perdre la saisie.
export default function StepBar({ step, labels, maxStepReached, onStepClick }) {
  const total = labels.length;
  const reachable = maxStepReached ?? step;

  return (
    <nav aria-label="Étapes" className="mb-5">
      <ol className="flex gap-1.5">
        {labels.map((label, i) => {
          const n = i + 1;
          const isCurrent = n === step;
          const isDone = n < step;
          const canJump = Boolean(onStepClick) && n <= reachable && !isCurrent;

          const content = (
            <>
              <span
                className={`block h-1.5 w-full rounded-full transition-colors ${
                  n <= step ? 'bg-primary-600' : n <= reachable ? 'bg-primary-200' : 'bg-surface-200'
                }`}
              />
              <span
                className={`mt-1.5 block truncate text-caption ${
                  isCurrent ? 'font-bold text-surface-900' : isDone || canJump ? 'font-semibold text-primary-700' : 'font-medium text-surface-400'
                }`}
              >
                {label}
              </span>
            </>
          );

          return (
            <li key={label} className="min-w-0 flex-1" aria-current={isCurrent ? 'step' : undefined}>
              {canJump ? (
                <button
                  type="button"
                  onClick={() => onStepClick(n)}
                  className="flex min-h-11 w-full flex-col justify-start pt-2 text-left"
                  aria-label={`Revenir à l'étape ${n} : ${label}`}
                >
                  {content}
                </button>
              ) : (
                <span className="flex min-h-11 flex-col justify-start pt-2">{content}</span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="sr-only">
        Étape {step} sur {total} : {labels[step - 1]}
      </p>
    </nav>
  );
}
