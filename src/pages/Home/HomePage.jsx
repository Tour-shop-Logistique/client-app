import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PackagePlus, Store, MapPinned, Package, Gift, Bell, Search, ChevronRight,
  ShoppingCart, Tag, Shirt, Smartphone, Home, Sparkles, Apple,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { ROUTES, expeditionDetailPath } from '../../routes';
import { fetchExpeditions } from '../../store/slices/expeditionSlice';
import { openAuthSheet } from '../../store/slices/uiSlice';
import logo from '../../assets/logo_transparent.png';

const CATEGORIES = [
  { label: 'Mode', icon: Shirt },
  { label: 'Électronique', icon: Smartphone },
  { label: 'Maison', icon: Home },
  { label: 'Beauté', icon: Sparkles },
  { label: 'Alimentation', icon: Apple },
];

const SHORTCUTS = [
  { to: ROUTES.EXPEDITION_HISTORY, icon: Package, label: 'Mes colis', color: 'bg-primary-50 text-primary-700' },
  { to: ROUTES.AGENCIES, icon: MapPinned, label: 'Agences', color: 'bg-navy-50 text-navy-600' },
  { to: ROUTES.MARKETPLACE_SELL, icon: Tag, label: 'Vendre', color: 'bg-shop-100 text-shop-800' },
  { to: ROUTES.PROFILE_REFERRAL, icon: Gift, label: 'Parrainage', color: 'bg-teal-50 text-teal-700' },
];

export default function HomePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  const [trackingCode, setTrackingCode] = useState('');
  const [searching, setSearching] = useState(false);

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
    <div className="safe-top pb-6">
      <div className="brand-gradient relative overflow-hidden pb-14 pt-4">
        <div className="pointer-events-none absolute -right-8 -top-14 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 left-4 h-32 w-32 rounded-full bg-shop-400/20" />

        <div className="page-container relative flex items-center justify-between">
          <img src={logo} alt="TourShop" className="h-10 w-auto object-contain" />
          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.MARKETPLACE_CART}
              className="rounded-full bg-white/15 p-2.5 text-white"
              aria-label="Panier"
            >
              <ShoppingCart size={20} />
            </Link>
            <Link to={ROUTES.PROFILE} className="rounded-full bg-white/15 p-2.5 text-white" aria-label="Profil">
              <Bell size={20} />
            </Link>
          </div>
        </div>

        <p className="page-container relative mt-3 text-body text-white/80">
          {user?.name ? `Bonjour, ${user.name}` : 'Bienvenue sur TourShop'}
        </p>
        <h1 className="page-container relative text-display text-white">Envoyez. Achetez. Vendez.</h1>
      </div>

      <div className="page-container relative -mt-8">
        <form onSubmit={handleTrackingSubmit} className="card p-4">
          <p className="text-body font-semibold text-surface-900">Suivez votre colis</p>
          <div className="mt-2.5 flex gap-2">
            <input
              type="text"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              placeholder="N° de suivi"
              className="input-field flex-1"
            />
            <button type="submit" className="btn-primary shrink-0 px-4" disabled={searching}>
              <Search size={16} />
              {searching ? '...' : 'Rechercher'}
            </button>
          </div>
        </form>
      </div>

      {/* Two universes: logistics (blue/teal) and commerce (lime). */}
      <div className="page-container mt-4 grid grid-cols-2 gap-3">
        <Link
          to={ROUTES.EXPEDITION_NEW}
          className="brand-gradient relative flex min-h-[9.5rem] flex-col justify-between overflow-hidden rounded-2xl p-4 shadow-brand"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <PackagePlus size={22} />
          </span>
          <div>
            <p className="text-title">Envoyer un colis</p>
            <p className="text-caption text-white/80">Interville et international</p>
          </div>
        </Link>
        <Link
          to={ROUTES.MARKETPLACE}
          className="shop-gradient relative flex min-h-[9.5rem] flex-col justify-between overflow-hidden rounded-2xl p-4"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/40">
            <Store size={22} />
          </span>
          <div>
            <p className="text-title">E-commerce</p>
            <p className="text-caption text-shop-900">Achetez, vendez, on livre</p>
          </div>
        </Link>
      </div>

      <div className="mt-5">
        <div className="page-container flex items-center justify-between">
          <h2 className="text-title text-surface-900">Catégories</h2>
          <Link to={ROUTES.MARKETPLACE} className="flex items-center text-caption font-medium text-primary-700">
            Tout voir <ChevronRight size={14} />
          </Link>
        </div>
        <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto px-4">
          {CATEGORIES.map((c) => (
            <Link key={c.label} to={ROUTES.MARKETPLACE} className="chip">
              <c.icon size={14} className="text-shop-700" />
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="page-container mt-5 grid grid-cols-4 gap-2.5">
        {SHORTCUTS.map((s) => (
          <Link key={s.label} to={s.to} className="flex flex-col items-center gap-1.5 text-center">
            <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${s.color}`}>
              <s.icon size={20} />
            </span>
            <span className="text-caption font-medium text-surface-700">{s.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
