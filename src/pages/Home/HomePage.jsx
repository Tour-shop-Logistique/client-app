import { Link } from 'react-router-dom';
import { PackagePlus, Globe2, Store, MapPinned, Gift, Bell } from 'lucide-react';
import { useSelector } from 'react-redux';
import { ROUTES } from '../../routes';

const QUICK_ACTIONS = [
  {
    to: ROUTES.EXPEDITION_INTERVILLE,
    icon: PackagePlus,
    label: 'Envoyer entre villes',
    desc: 'Interville',
    color: 'bg-primary-50 text-primary-600',
  },
  {
    to: ROUTES.EXPEDITION_EXTRAPAYS,
    icon: Globe2,
    label: 'Envoyer a l’international',
    desc: 'Extrapays',
    color: 'bg-accent-50 text-accent-600',
  },
  {
    to: ROUTES.MARKETPLACE,
    icon: Store,
    label: 'Marketplace',
    desc: 'Acheter / vendre',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    to: ROUTES.AGENCIES,
    icon: MapPinned,
    label: 'Agences',
    desc: 'Trouver un point relais',
    color: 'bg-violet-50 text-violet-600',
  },
];

function QuickActionCard({ action }) {
  return (
    <Link to={action.to} className="card flex flex-col gap-3 p-4">
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${action.color}`}>
        <action.icon size={20} />
      </span>
      <div>
        <p className="text-sm font-semibold text-surface-900">{action.label}</p>
        <p className="text-xs text-surface-500">{action.desc}</p>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const user = useSelector((state) => state.auth.user);

  return (
    <div className="page-container safe-top pt-4">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-surface-500">Bonjour{user?.name ? `,` : ''}</p>
          <h1 className="text-xl font-bold text-surface-900">{user?.name || 'Bienvenue sur TourShop'}</h1>
        </div>
        <Link
          to={ROUTES.PROFILE}
          className="rounded-full bg-white p-2.5 text-surface-600 shadow-card"
          aria-label="Notifications"
        >
          <Bell size={20} />
        </Link>
      </div>

      <div className="card mb-5 overflow-hidden bg-gradient-to-br from-primary-600 to-primary-700 p-5 text-white">
        <p className="text-sm font-medium text-primary-100">Expedier un colis</p>
        <p className="mt-1 text-lg font-semibold">Rapide, suivi en temps reel</p>
        <div className="mt-4 flex gap-2">
          <Link to={ROUTES.EXPEDITION_INTERVILLE} className="btn bg-white text-primary-700 flex-1">
            Interville
          </Link>
          <Link to={ROUTES.EXPEDITION_EXTRAPAYS} className="btn bg-primary-500/40 text-white flex-1 border border-white/30">
            Extrapays
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((action) => (
          <QuickActionCard key={action.to} action={action} />
        ))}
      </div>

      <Link
        to={ROUTES.PROFILE_REFERRAL}
        className="card mt-3 flex items-center gap-3 p-4"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <Gift size={20} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-surface-900">Parrainez vos proches</p>
          <p className="text-xs text-surface-500">Gagnez un bonus a chaque expedition de vos filleuls</p>
        </div>
      </Link>
    </div>
  );
}
