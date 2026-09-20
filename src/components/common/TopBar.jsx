import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function TopBar({ title, back = false, right = null }) {
  const navigate = useNavigate();

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-surface-100 bg-white/90 backdrop-blur">
      <div className="page-container flex h-14 items-center justify-between">
        <div className="flex items-center gap-1 min-w-0">
          {back && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="-ml-2 rounded-full p-2 text-primary-700 hover:bg-primary-50"
              aria-label="Retour"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <h1 className="truncate font-heading text-base font-semibold text-surface-900">{title}</h1>
        </div>
        {right}
      </div>
    </header>
  );
}
