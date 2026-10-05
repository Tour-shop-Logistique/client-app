import { Clock, Check, X } from 'lucide-react';
import { LiveDot } from '../illustrations';
import { TONE_CLASSES } from '../../utils/marketplace';

// Kit visuel : icône + couleur + texte. Les états « en cours » (tone info)
// pulsent ; la couleur seule ne porte jamais l'information.
const TONE_ICONS = { warning: Clock, success: Check, danger: X };

// Pastille de statut. `map` = un des dictionnaires de utils/marketplace.js.
export default function StatusBadge({ map, value, short = false, className = '' }) {
  const entry = map[value] ?? { label: value || '—', tone: 'neutral' };
  const Icon = TONE_ICONS[entry.tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold ${TONE_CLASSES[entry.tone]} ${className}`}
    >
      {entry.tone === 'info' ? (
        <LiveDot className="bg-current" />
      ) : Icon ? (
        <Icon size={12} strokeWidth={2.8} />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      )}
      {short && entry.short ? entry.short : entry.label}
    </span>
  );
}
