import { ClipboardCheck, Truck, PackageCheck, Warehouse, PlaneTakeoff, PlaneLanding, Building2, House } from 'lucide-react';
import { getMilestones } from '../../utils/expeditionStatus';
import { formatDateTime } from '../../utils/format';

// Une icône par jalon (kit visuel) — le libellé reste la source d'information.
const STEP_ICONS = {
  cree: ClipboardCheck,
  enleve: Truck,
  depot: PackageCheck,
  entrepot: Warehouse,
  depart: PlaneTakeoff,
  arrivee: PlaneLanding,
  agence: Building2,
  remis: House,
};

// Frise de suivi d'une expédition, construite à partir des dates de jalons
// renvoyées par GET /expedition/client/show/{id} (cahier 4.2 / 4.3 : suivi à
// chaque étape). La première étape non franchie est mise en avant et pulse.
export default function TrackingTimeline({ expedition }) {
  const steps = getMilestones(expedition);
  const nextIndex = steps.findIndex((s) => !s.done);

  return (
    <ol>
      {steps.map((step, i) => {
        const next = i === nextIndex;
        const last = i === steps.length - 1;
        const Icon = STEP_ICONS[step.key] || PackageCheck;
        return (
          <li key={step.key} className="relative flex gap-3.5">
            <div className="flex flex-col items-center">
              <span className="relative flex h-10 w-10 shrink-0" aria-hidden="true">
                {next && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-shop-400" />}
                <span
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full ${
                    step.done
                      ? 'bg-primary-600 text-white'
                      : next
                        ? 'bg-shop-400 text-shop-950 ring-4 ring-shop-100'
                        : 'bg-surface-100 text-surface-400'
                  }`}
                >
                  <Icon size={18} strokeWidth={2.2} />
                </span>
              </span>
              {!last && (
                <span
                  className={`w-[3px] flex-1 rounded-full ${
                    step.done && steps[i + 1]?.done
                      ? 'bg-primary-600'
                      : step.done
                        ? 'bg-gradient-to-b from-primary-600 to-shop-400'
                        : 'bg-surface-200'
                  }`}
                  style={{ minHeight: 18 }}
                  aria-hidden="true"
                />
              )}
            </div>
            <div className={`min-w-0 flex-1 pt-1 ${last ? '' : 'pb-4'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className={`text-sm ${step.done ? 'font-semibold text-surface-900' : next ? 'font-bold text-surface-900' : 'font-medium text-surface-500'}`}>
                  {step.label}
                  <span className="sr-only">{step.done ? ' : fait' : next ? ' : prochaine étape' : ' : à venir'}</span>
                </p>
                {next && (
                  <span className="rounded-full bg-shop-100 px-2 py-0.5 text-[11px] font-bold text-shop-800" aria-hidden="true">
                    Prochaine étape
                  </span>
                )}
              </div>
              {step.date && (
                <p className={`text-xs ${step.planned ? 'text-amber-700' : 'text-surface-500'}`}>
                  {step.planned ? 'Prévu le ' : ''}{formatDateTime(step.date)}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
