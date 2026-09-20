import { NavLink } from 'react-router-dom';
import { Home, Package, Store, MapPinned, User } from 'lucide-react';
import { ROUTES } from '../../routes';
import { isFeatureReady } from '../../config/features';

const TABS = [
  { to: ROUTES.HOME, icon: Home, label: 'Accueil', end: true, feature: 'home' },
  { to: ROUTES.EXPEDITION_HISTORY, icon: Package, label: 'Colis', feature: 'expeditionHistory' },
  { to: ROUTES.MARKETPLACE, icon: Store, label: 'E-commerce', feature: 'marketplace' },
  { to: ROUTES.AGENCIES, icon: MapPinned, label: 'Agences', feature: 'agencies' },
  { to: ROUTES.PROFILE, icon: User, label: 'Profil', feature: 'profile' },
];

function NavItem({ tab }) {
  const comingSoon = !isFeatureReady(tab.feature);

  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
          isActive ? 'text-primary-600' : 'text-surface-400'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`relative flex h-8 w-11 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-primary-50' : ''}`}>
            <tab.icon size={20} strokeWidth={isActive ? 2.4 : 2} />
            {comingSoon && (
              <span
                className="absolute right-1.5 top-0.5 h-2 w-2 rounded-full bg-shop-500 ring-2 ring-white"
                aria-label="Bientôt disponible"
              />
            )}
          </span>
          {tab.label}
        </>
      )}
    </NavLink>
  );
}

export default function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-surface-100 bg-white shadow-nav">
      <div className="mx-auto grid h-bottom-nav max-w-md grid-cols-5">
        {TABS.map((tab) => (
          <NavItem key={tab.to} tab={tab} />
        ))}
      </div>
    </nav>
  );
}
