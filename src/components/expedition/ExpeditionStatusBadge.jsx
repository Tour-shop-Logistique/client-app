import { Clock, CheckCircle2, Check, X } from 'lucide-react';
import { LiveDot } from '../illustrations';
import { EN_COURS_STATUSES, getStatutMeta } from '../../utils/expeditionStatus';

// Badge de statut du kit visuel : icône + couleur + texte (la couleur seule
// ne porte jamais l'information). Les statuts « en cours » pulsent.
const ICONS = {
  en_attente: Clock,
  accepted: CheckCircle2,
  termined: Check,
  cancelled: X,
  refused: X,
};

export default function ExpeditionStatusBadge({ statut, className = '' }) {
  const meta = getStatutMeta(statut);
  const Icon = ICONS[statut];
  const live = EN_COURS_STATUSES.includes(statut);

  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.className} ${className}`}>
      {live ? <LiveDot className="bg-current" /> : Icon && <Icon size={12} strokeWidth={2.6} />}
      {meta.label}
    </span>
  );
}
