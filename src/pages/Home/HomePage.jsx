import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PackagePlus, Store, MapPin, MapPinned, Package, Gift, Bell, Search, ChevronRight, ArrowRight,
  ShoppingCart, Tag, Shirt, Smartphone, Home, Sparkles, Apple, Truck, Navigation,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { ROUTES, expeditionDetailPath } from '../../routes';
import { fetchExpeditions } from '../../store/slices/expeditionSlice';
import { selectCartCount } from '../../store/slices/cartSlice';
import { openAuthSheet } from '../../store/slices/uiSlice';
import { CLOSED_STATUSES, getProgress, villeDepart, villeDestination } from '../../utils/expeditionStatus';
import { firstName, userInitials } from '../../utils/user';
import ExpeditionStatusBadge from '../../components/expedition/ExpeditionStatusBadge';
import { HeroGlobeArt, PaperPlaneArt, ShopBagArt, GiftArt, MiniMapArt } from '../../components/illustrations';
import logo from '../../assets/logo_transparent.png';

const CATEGORIES = [
  { label: 'Mode', icon: Shirt, tint: 'bg-pink-50 text-pink-700' },
  { label: 'Électronique', icon: Smartphone, tint: 'bg-primary-100 text-primary-600' },
  { label: 'Maison', icon: Home, tint: 'bg-orange-100 text-amber-700' },
  { label: 'Beauté', icon: Sparkles, tint: 'bg-violet-100 text-violet-700' },
  { label: 'Alimentation', icon: Apple, tint: 'bg-shop-100 text-shop-700' },
];

const SHORTCUTS = [
  { to: ROUTES.EXPEDITION_HISTORY, icon: Package, label: 'Mes colis', color: 'bg-primary-100 text-primary-600' },
  { to: ROUTES.AGENCIES, icon: MapPinned, label: 'Agences', color: 'bg-teal-100 text-teal-600' },
  { to: ROUTES.MARKETPLACE_SELL, icon: Tag, label: 'Vendre', color: 'bg-shop-100 text-shop-700' },
  { to: ROUTES.PROFILE_REFERRAL, icon: Gift, label: 'Parrainage', color: 'bg-orange-100 text-amber-700' },
];

function SectionHeader({ title, to, linkLabel = 'Tout voir' }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="font-heading text-[17px] font-semibold text-surface-900">{title}</h2>
      {to && (
        <Link to={to} className="flex items-center text-caption font-semibold text-primary-700">
          {linkLabel} <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

// Dernier colis actif avec sa progression (camion sur la barre).
function LiveParcelCard({ exp }) {
  const { ratio, nextLabel } = getProgress(exp);
  const pct = Math.round(Math.min(Math.max(ratio, 0.08), 0.96) * 100);

  return (
    <Link to={expeditionDetailPath(exp.id)} className="card block p-4 transition active:scale-[0.99]">
      <div className="flex items-center gap-3">
        <span className="icon-tile h-11 w-11 bg-primary-100 text-primary-600">
          <Package size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-[15px] font-semibold text-surface-900">{exp.reference || 'Demande'}</p>
          <p className="truncate text-body text-surface-500">
            {villeDepart(exp)} → {villeDestination(exp)}
          </p>
        </div>
        <ExpeditionStatusBadge statut={exp.statut_expedition} />
      </div>

      <div className="relative mx-1 mb-2.5 mt-5 h-1.5 rounded-full bg-surface-200">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-primary-600 to-teal-400 transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
        <span
          className="absolute -top-[13px] -ml-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary-600 shadow-md transition-[left] duration-700"
          style={{ left: `${pct}%` }}
          aria-hidden="true"
        >
          <Truck size={16} strokeWidth={2.2} />
        </span>
      </div>
      {nextLabel && (
        <p className="text-caption text-surface-500">
          Prochaine étape : <span className="font-semibold text-surface-800">{nextLabel}</span>
        </p>
      )}
    </Link>
  );
}

export default function HomePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const countryName = useSelector((state) => state.country.name);
  const cartCount = useSelector(selectCartCount);
  const { items: expeditions, status: expStatus } = useSelector((state) => state.expeditions);

  const [trackingCode, setTrackingCode] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (isAuthenticated && expStatus === 'idle' && expeditions.length === 0) dispatch(fetchExpeditions());
  }, [dispatch, isAuthenticated, expStatus, expeditions.length]);

  const liveParcel = expeditions.find((e) => !CLOSED_STATUSES.includes(e.statut_expedition));
  const name = firstName(user);

  const handleTrackingSubmit = async (e) => {
    e.preventDefault();
    const code = trackingCode.trim();
    if (!code) return;

    if (!isAuthenticated) {
      dispatch(openAuthSheet({ mode: 'login', reason: 'default' }));
      return;
    }

    setSearching(true);
    try {
      const result = await dispatch(fetchExpeditions());
      if (fetchExpeditions.fulfilled.match(result)) {
        const match = (result.payload || []).find(
          (exp) => (exp.reference || '').toLowerCase() === code.toLowerCase()
        );
        if (match) {
          navigate(expeditionDetailPath(match.id));
        } else {
          toast.error('Aucune expédition trouvée pour ce numéro.');
        }
      } else {
        toast.error('Recherche impossible pour le moment.');
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="safe-top pb-4">
      {/* Héros illustré */}
      <div className="brand-gradient relative h-[19.5rem] overflow-hidden rounded-b-[2rem] px-5 pt-5">
        <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/[0.07]" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-shop-400/20" />

        <div className="relative mx-auto flex max-w-md items-center justify-between">
          {isAuthenticated && userInitials(user) ? (
            <Link to={ROUTES.PROFILE} className="flex items-center gap-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-shop-400 font-heading text-[15px] font-bold text-shop-950 ring-[3px] ring-white/25">
                {userInitials(user)}
              </span>
              <span className="flex flex-col">
                <span className="text-body text-white/85">Bonjour{name ? `, ${name}` : ''}</span>
                {countryName && (
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    <MapPin size={14} className="text-shop-300" strokeWidth={2.4} /> {countryName}
                  </span>
                )}
              </span>
            </Link>
          ) : (
            <img src={logo} alt="TourShop" className="h-10 w-auto object-contain" />
          )}
          <div className="flex items-center gap-2">
            <Link to={ROUTES.PROFILE} className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/15" aria-label="Notifications">
              <Bell size={20} />
            </Link>
            <Link
              to={ROUTES.MARKETPLACE_CART}
              className="relative flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/15"
              aria-label={cartCount ? `Panier, ${cartCount} article${cartCount > 1 ? 's' : ''}` : 'Panier'}
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-shop-400 px-1 text-[11px] font-bold text-shop-950 ring-2 ring-primary-700">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        <div className="relative mx-auto mt-6 max-w-md">
          <h1 className="w-52 font-heading text-[27px] font-bold leading-[33px] tracking-tight">
            Envoyez.<br />Achetez.<br /><span className="text-shop-300">Vendez.</span>
          </h1>
          <p className="mt-2 w-52 text-body text-white/85">Colis, boutique et agences, tout au même endroit.</p>
          <HeroGlobeArt className="pointer-events-none absolute -right-3 top-0 animate-float" />
        </div>
      </div>

      <div className="page-container relative z-10 -mt-12 space-y-6">
        {/* Suivi */}
        <form onSubmit={handleTrackingSubmit} className="rounded-[1.4rem] bg-white p-4 shadow-[0_16px_36px_-14px_rgba(15,23,42,0.28)]">
          <label htmlFor="home-tracking" className="font-heading text-[15px] font-semibold text-surface-900">
            Suivre un colis
          </label>
          <div className="mt-2.5 flex gap-2">
            <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-[14px] bg-surface-100 px-3 text-surface-500 focus-within:ring-2 focus-within:ring-primary-500">
              <Search size={18} className="shrink-0" />
              <input
                id="home-tracking"
                type="text"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="N° de suivi"
                className="min-w-0 flex-1 bg-transparent text-surface-900 placeholder:text-surface-500 focus:outline-none"
              />
            </div>
            <button type="submit" className="btn-primary h-12 shrink-0 rounded-[14px] px-4" disabled={searching}>
              {searching ? '...' : 'Suivre'}
            </button>
          </div>
        </form>

        {liveParcel && (
          <section className="space-y-2.5">
            <SectionHeader title="Colis en cours" to={ROUTES.EXPEDITION_HISTORY} />
            <LiveParcelCard exp={liveParcel} />
          </section>
        )}

        {/* Deux univers : logistique (bleu/teal) et commerce (lime). */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to={ROUTES.EXPEDITION_NEW}
            className="brand-gradient relative flex h-44 flex-col justify-between overflow-hidden rounded-3xl p-4 shadow-brand transition active:scale-[0.98]"
          >
            <span className="icon-tile h-10 w-10 rounded-[14px] bg-white/20">
              <PackagePlus size={22} />
            </span>
            <PaperPlaneArt className="pointer-events-none absolute -right-2 top-2 animate-float" />
            <span className="flex flex-col">
              <span className="font-heading text-base font-semibold">Envoyer un colis</span>
              <span className="text-caption text-white/90">Ville à ville et international</span>
            </span>
          </Link>
          <Link
            to={ROUTES.MARKETPLACE}
            className="relative flex h-44 flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-shop-200 to-shop-400 p-4 text-shop-950 transition active:scale-[0.98]"
          >
            <span className="icon-tile h-10 w-10 rounded-[14px] bg-white/50">
              <Store size={22} />
            </span>
            <ShopBagArt className="pointer-events-none absolute right-0.5 top-1.5 animate-float [animation-delay:0.6s]" />
            <span className="flex flex-col">
              <span className="font-heading text-base font-semibold">Boutique</span>
              <span className="text-caption text-shop-900">Achetez, vendez, on livre</span>
            </span>
          </Link>
        </div>

        {/* Raccourcis en pastilles colorées */}
        <div className="card grid grid-cols-4 gap-1 px-2 py-4">
          {SHORTCUTS.map((s) => (
            <Link key={s.label} to={s.to} className="flex flex-col items-center gap-2 text-center text-caption font-semibold text-surface-700">
              <span className={`icon-tile h-[52px] w-[52px] rounded-[17px] transition active:scale-90 ${s.color}`}>
                <s.icon size={22} />
              </span>
              {s.label}
            </Link>
          ))}
        </div>

        {/* Bannière parrainage */}
        <Link to={ROUTES.PROFILE_REFERRAL} className="relative block h-36 overflow-hidden rounded-3xl bg-navy-800 p-[18px] text-white">
          <div className="pointer-events-none absolute -bottom-10 -right-8 h-36 w-36 rounded-full bg-shop-400/15" />
          <span className="relative inline-block rounded-full bg-shop-400 px-2.5 py-0.5 text-[11px] font-bold text-shop-950">Parrainage</span>
          <p className="relative mb-2.5 mt-2 w-52 font-heading text-base font-semibold leading-[21px]">
            Invitez vos proches, gagnez des récompenses
          </p>
          <span className="relative inline-flex items-center gap-1.5 text-body font-semibold text-shop-300">
            Inviter maintenant <ArrowRight size={15} strokeWidth={2.4} />
          </span>
          <GiftArt className="pointer-events-none absolute right-3.5 top-4 animate-float" />
        </Link>

        {/* Catégories */}
        <section className="space-y-3">
          <SectionHeader title="Catégories" to={ROUTES.MARKETPLACE} />
          <div className="flex justify-between">
            {CATEGORIES.map((c) => (
              <Link key={c.label} to={ROUTES.MARKETPLACE} className="flex w-16 flex-col items-center gap-1.5 text-caption font-medium text-surface-700">
                <span className={`flex h-[60px] w-[60px] items-center justify-center rounded-full transition active:scale-90 ${c.tint}`}>
                  <c.icon size={24} />
                </span>
                {c.label}
              </Link>
            ))}
          </div>
        </section>

        {/* Agences */}
        <section className="space-y-2.5">
          <SectionHeader title="Nos agences" />
          <Link to={ROUTES.AGENCIES} className="card block overflow-hidden transition active:scale-[0.99]">
            <MiniMapArt className="block h-24 w-full" />
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-surface-900">Trouver une agence près de chez vous</p>
                <p className="text-caption text-surface-500">Dépôt, retrait et horaires d'ouverture</p>
              </div>
              <span className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-teal-100 px-3.5 text-body font-semibold text-teal-700">
                <Navigation size={15} strokeWidth={2.2} /> Voir
              </span>
            </div>
          </Link>
        </section>
      </div>
    </div>
  );
}
