import { Link } from 'react-router-dom';
import { PackagePlus, Globe2 } from 'lucide-react';
import TopBar from '../../components/common/TopBar';
import { ROUTES } from '../../routes';

export default function NewExpeditionPage() {
  return (
    <div>
      <TopBar title="Nouvelle expedition" back />
      <div className="page-container space-y-3 py-4">
        <Link to={ROUTES.EXPEDITION_INTERVILLE} className="card flex items-center gap-4 p-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <PackagePlus size={22} />
          </span>
          <div className="flex-1">
            <p className="font-semibold text-surface-900">Interville</p>
            <p className="text-sm text-surface-500">Entre deux villes d'un meme pays</p>
          </div>
        </Link>
        <Link to={ROUTES.EXPEDITION_EXTRAPAYS} className="card flex items-center gap-4 p-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
            <Globe2 size={22} />
          </span>
          <div className="flex-1">
            <p className="font-semibold text-surface-900">Extrapays</p>
            <p className="text-sm text-surface-500">Expedition internationale entre pays</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
