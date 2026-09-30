import { TONE_CLASSES } from '../../utils/marketplace';

// Pastille de statut. `map` = un des dictionnaires de utils/marketplace.js.
export default function StatusBadge({ map, value, short = false, className = '' }) {
  const entry = map[value] ?? { label: value || '—', tone: 'neutral' };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-caption font-semibold ${TONE_CLASSES[entry.tone]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {short && entry.short ? entry.short : entry.label}
    </span>
  );
}
