import { Minus, Plus } from 'lucide-react';
import { decimalClean, decimalDisplay } from '../../utils/decimal';

const STEP = 0.5;

const toNumber = (v) => Number(String(v ?? '').replace(',', '.')) || 0;
const toValue = (n) => String(Math.round(n * 100) / 100);

// Poids en kg : boutons − / + (pas de 0,5 kg) pour le pouce, et saisie directe
// au clavier décimal pour une valeur précise. La virgule est acceptée.
// `value` reste une chaîne (comme le reste du formulaire) ; vide = non saisi.
export default function WeightStepper({ id, value, onChange, label = 'Poids du colis' }) {
  const n = toNumber(value);

  const decrease = () => {
    const next = Math.round((n - STEP) * 100) / 100;
    onChange(next > 0 ? toValue(next) : '');
  };
  const increase = () => onChange(toValue(n + STEP));
  const type = (e) => onChange(decimalClean(e.target.value));

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-surface-700">
        {label}
      </label>
      <div className="flex h-14 items-stretch overflow-hidden rounded-xl border border-surface-200 bg-white focus-within:border-transparent focus-within:ring-2 focus-within:ring-primary-500">
        <button
          type="button"
          onClick={decrease}
          disabled={n <= 0}
          aria-label="Retirer 0,5 kg"
          className="flex w-14 shrink-0 items-center justify-center text-primary-600 transition active:bg-primary-50 disabled:text-surface-300"
        >
          <Minus size={20} strokeWidth={2.4} />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1 border-x border-surface-100">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={decimalDisplay(value)}
            onChange={type}
            onFocus={(e) => e.target.select()}
            className="w-20 bg-transparent text-center font-heading text-xl font-bold text-surface-900 placeholder:text-surface-300 focus:outline-none"
          />
          <span className="text-sm font-medium text-surface-500">kg</span>
        </div>
        <button
          type="button"
          onClick={increase}
          aria-label="Ajouter 0,5 kg"
          className="flex w-14 shrink-0 items-center justify-center text-primary-600 transition active:bg-primary-50"
        >
          <Plus size={20} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
