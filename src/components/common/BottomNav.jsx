import { NavLink } from 'react-router-dom';
import { Home, Package, Store, User, Plus } from 'lucide-react';
import { ROUTES } from '../../routes';
import { isFeatureReady } from '../../config/features';

// Barre flottante : 4 onglets + bouton central « Envoyer » mis en avant.
// Les agences restent accessibles depuis les raccourcis de l'accueil.
const TABS = [
  { to: ROUTES.HOME, icon: Home, label: 'Accueil', end: true, feature: 'home' },
  { to: ROUTES.EXPEDITION_HISTORY, icon: Package, label: 'Colis', feature: 'expeditionHistory' },
  { to: ROUTES.EXPEDITION_NEW, icon: Plus, label: 'Envoyer', feature: 'expeditionNew', primary: true },
  { to: ROUTES.MARKETPLACE, icon: Store, label: 'Boutique', feature: 'marketplace', shop: true },
  { to: ROUTES.PROFILE, icon: User, label: 'Profil', feature: 'profile' },
];

function PrimaryAction({ tab }) {
  return (
    <NavLink
      to={tab.to}
      className="relative -mt-7 flex flex-col items-center justify-start gap-1 text-[11px] font-bold text-primary-700"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-600 to-teal-600 text-white shadow-brand ring-[5px] ring-surface-50 transition active:scale-90">
        <tab.icon size={26} strokeWidth={2.6} />
      </span>
      {tab.label}
    </NavLink>
  );
}

function NavItem({ tab }) {
  const comingSoon = !isFeatureReady(tab.feature);
  const activeText = tab.shop ? 'text-shop-800' : 'text-primary-600';
  const activePill = tab.shop ? 'bg-shop-100' : 'bg-primary-50';

  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-1 text-[11px] transition ${
          isActive ? `${activeText} font-bold` : 'font-medium text-surface-500'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`relative flex h-8 w-11 items-center justify-center rounded-full transition-colors ${isActive ? activePill : ''}`}>
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
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <div className="mx-auto grid h-bottom-nav max-w-md grid-cols-5 items-center rounded-[1.6rem] bg-white shadow-[0_14px_34px_-10px_rgba(15,23,42,0.3)] ring-1 ring-surface-100">
        {TABS.map((tab) =>
          tab.primary ? <PrimaryAction key={tab.to} tab={tab} /> : <NavItem key={tab.to} tab={tab} />
        )}
      </div>
    </nav>
  );
}
