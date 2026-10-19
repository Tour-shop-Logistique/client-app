import { NavLink } from 'react-router-dom';
import useTyping from '../../hooks/useTyping';
import { Home, Package, Store, User, Plus } from 'lucide-react';
import { ROUTES } from '../../routes';
import { isFeatureReady } from '../../config/features';

// Barre flottante : 4 onglets + bouton central « Envoyer » mis en avant.
// Les agences restent accessibles depuis les raccourcis de l'accueil.
//
// Rendu multi-appareils :
//  - les 5 cellules ont la même structure (contenu calé en bas, libellé sur une
//    seule ligne) : tous les libellés sont alignés, y compris sous le bouton
//    central, qui déborde simplement vers le haut ;
//  - zones de sécurité : bas (barre d'accueil iOS, navigation par gestes
//    Android) et côtés (encoche en paysage) ;
//  - la barre se replie pendant une saisie : sur Android le clavier réduit la
//    fenêtre et la barre viendrait se poser sur le champ.
const TABS = [
  { to: ROUTES.HOME, icon: Home, label: 'Accueil', end: true, feature: 'home' },
  { to: ROUTES.EXPEDITION_HISTORY, icon: Package, label: 'Colis', feature: 'expeditionHistory' },
  { to: ROUTES.EXPEDITION_NEW, icon: Plus, label: 'Envoyer', feature: 'expeditionNew', primary: true },
  { to: ROUTES.MARKETPLACE, icon: Store, label: 'Boutique', feature: 'marketplace', shop: true },
  { to: ROUTES.PROFILE, icon: User, label: 'Profil', feature: 'profile' },
];

// `min-h-0` + ligne de grille bornée (voir <nav>) : la hauteur d'une cellule ne
// dépend jamais de son contenu. Le bouton central, plus haut que la barre,
// déborde vers le haut (flex justify-end) sans pousser les libellés dehors.
const CELL = 'relative flex h-full min-h-0 min-w-0 select-none flex-col items-center justify-end gap-1 px-0.5 pb-2.5 text-[11px] leading-3 [-webkit-tap-highlight-color:transparent]';

function PrimaryAction({ tab }) {
  return (
    <NavLink to={tab.to} className={`${CELL} font-bold text-primary-700`}>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-600 to-teal-600 text-white shadow-brand ring-[5px] ring-surface-50 transition active:scale-90">
        <tab.icon size={26} strokeWidth={2.6} />
      </span>
      <span className="max-w-full truncate">{tab.label}</span>
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
        `${CELL} transition ${isActive ? `${activeText} font-bold` : 'font-medium text-surface-500'}`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`relative flex h-8 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${isActive ? activePill : ''}`}>
            <tab.icon size={20} strokeWidth={isActive ? 2.4 : 2} />
            {comingSoon && (
              <span
                className="absolute right-1.5 top-0.5 h-2 w-2 rounded-full bg-shop-500 ring-2 ring-white"
                aria-label="Bientôt disponible"
              />
            )}
          </span>
          <span className="max-w-full truncate">{tab.label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function BottomNav() {
  const typing = useTyping();

  return (
    <nav
      aria-label="Navigation principale"
      aria-hidden={typing || undefined}
      // Bas : barre d'accueil iOS (≈34 px) rognée de 0,25 rem pour ne pas flotter
      // trop haut ; navigation par gestes ou boutons Android : au moins 0,75 rem.
      // Côtés : encoche en paysage.
      className={`fixed inset-x-0 bottom-0 z-30 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)-0.25rem))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] transition-transform duration-200 ease-out ${
        typing ? 'pointer-events-none translate-y-[calc(100%+1rem)]' : ''
      }`}
    >
      <div className="mx-auto grid h-bottom-nav max-w-md grid-cols-5 grid-rows-[minmax(0,1fr)] items-stretch rounded-[1.6rem] bg-white shadow-[0_14px_34px_-10px_rgba(15,23,42,0.3)] ring-1 ring-surface-100">
        {TABS.map((tab) =>
          tab.primary ? <PrimaryAction key={tab.to} tab={tab} /> : <NavItem key={tab.to} tab={tab} />
        )}
      </div>
    </nav>
  );
}
