import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// `onBack` remplace le retour par défaut (navigate(-1)), ex. pour revenir à
// l'étape précédente d'un parcours ; `backLabel` en donne le libellé accessible.
export default function TopBar({ title, subtitle = null, back = false, right = null, onBack = null, backLabel = 'Retour' }) {
  const navigate = useNavigate();

  return (
    <header className="safe-top sticky top-0 z-30 bg-surface-50/90 backdrop-blur">
      <div className="page-container flex h-16 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {back && (
            <button
              type="button"
              onClick={() => (onBack ? onBack() : navigate(-1))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-surface-900 shadow-card transition active:scale-90"
              aria-label={backLabel}
            >
              <ChevronLeft size={21} strokeWidth={2.4} />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-heading text-lg font-bold text-surface-900">{title}</h1>
            {subtitle && <p className="truncate text-caption text-surface-500">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}
