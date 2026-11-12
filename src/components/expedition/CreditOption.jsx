import { Wallet } from 'lucide-react';

// Option « Payer à crédit » (Interville et Groupage — jamais pour la livraison
// à domicile, où l'API ignore le champ). Envoyée dans `is_paiement_credit`.
export default function CreditOption({ value, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
        value ? 'border-primary-400 bg-primary-50' : 'border-surface-300 bg-white shadow-sm hover:border-primary-300'
      }`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${value ? 'bg-primary-100 text-primary-700' : 'bg-surface-100 text-surface-500'}`}>
        <Wallet size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-surface-900">Payer à crédit</span>
        <span className="block text-xs leading-snug text-surface-500">
          Paiement différé, à l’arrivée ou selon l’accord de l’agence.
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${value ? 'bg-primary-600' : 'bg-surface-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
