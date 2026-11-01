import { Check } from 'lucide-react';

// Cartes de choix de l'étape « Remise » : méthode (déposer / livreur), mode
// (express / classique) et véhicule. Zones tactiles larges, état sélectionné
// net (bordure, pastille pleine, coche), prix visible dans la carte.

const BADGE_TONES = {
  neutral: 'bg-surface-100 text-surface-600',
  success: 'bg-emerald-50 text-emerald-700',
  price: 'bg-primary-100 text-primary-700',
  accent: 'bg-shop-100 text-shop-800',
  warn: 'bg-amber-50 text-amber-700',
};

const frame = (selected) => (selected
  ? 'border-primary-600 bg-primary-50/60 shadow-card'
  : 'border-surface-200 bg-white');

function Radio({ selected }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
        selected ? 'border-primary-600 bg-primary-600 text-white' : 'border-surface-300 bg-white'
      }`}
    >
      {selected && <Check size={12} strokeWidth={3.2} />}
    </span>
  );
}

// Carte en ligne : icône, titre + description, pastille (prix, « Gratuit »…).
export function OptionRow({
  selected, onClick, icon: Icon, title, hint, badge, badgeTone = 'neutral', disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition active:scale-[0.99] disabled:opacity-50 ${frame(selected)}`}
    >
      <span className={`icon-tile h-11 w-11 shrink-0 rounded-xl transition ${selected ? 'bg-primary-600 text-white' : 'bg-surface-100 text-surface-500'}`}>
        {Icon && <Icon size={20} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-surface-900">{title}</span>
        {hint && <span className="mt-0.5 block text-xs leading-snug text-surface-500">{hint}</span>}
      </span>
      {badge && (
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${BADGE_TONES[badgeTone]}`}>{badge}</span>
      )}
      <Radio selected={selected} />
    </button>
  );
}

// Carte verticale (2 par ligne) : icône + étiquette, titre, description, prix en bas.
export function OptionTile({
  selected, onClick, icon: Icon, title, hint, tag, tagTone = 'accent', price, priceNote, disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex min-w-0 flex-col rounded-2xl border-2 p-3 text-left transition active:scale-[0.99] disabled:opacity-50 ${frame(selected)}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className={`icon-tile h-10 w-10 shrink-0 rounded-xl transition ${selected ? 'bg-primary-600 text-white' : 'bg-surface-100 text-surface-500'}`}>
          {Icon && <Icon size={19} aria-hidden="true" />}
        </span>
        <Radio selected={selected} />
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold text-surface-900">{title}</span>
        {tag && <span className={`rounded-full px-2 py-px text-[11px] font-bold ${BADGE_TONES[tagTone]}`}>{tag}</span>}
      </span>
      {hint && <span className="mt-0.5 text-xs leading-snug text-surface-500">{hint}</span>}
      <span className="mt-auto pt-2">
        <span className={`block font-heading text-base font-bold ${price ? 'text-surface-900' : 'text-surface-300'}`}>{price || '—'}</span>
        {priceNote && <span className="block text-[11px] leading-tight text-surface-500">{priceNote}</span>}
      </span>
    </button>
  );
}

// Petite tuile compacte (véhicule) : icône + libellé + précision.
export function OptionChip({
  selected, onClick, icon: Icon, title, hint,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-w-0 items-center gap-2.5 rounded-2xl border-2 p-2.5 text-left transition active:scale-[0.99] ${frame(selected)}`}
    >
      <span className={`icon-tile h-9 w-9 shrink-0 rounded-xl transition ${selected ? 'bg-primary-600 text-white' : 'bg-surface-100 text-surface-500'}`}>
        {Icon && <Icon size={18} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-surface-900">{title}</span>
        {hint && <span className="block truncate text-[11px] text-surface-500">{hint}</span>}
      </span>
    </button>
  );
}
