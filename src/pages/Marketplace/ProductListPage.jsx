import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, X, Heart, ShoppingBag, Store, Tag, SlidersHorizontal, LayoutGrid, Rows3,
  RefreshCw, Clock, History, Truck, ShieldCheck, Wallet, Plus, Globe2, MapPin,
  ChevronRight, Flame,
} from 'lucide-react';
import CartButton from '../../components/marketplace/CartButton';
import ProductCard, { ProductCardSkeleton, ProductImage, FavoriteButton } from '../../components/marketplace/ProductCard';
import AbonnementBanner from '../../components/marketplace/AbonnementBanner';
import GuestGate from '../../components/marketplace/GuestGate';
import BottomSheet from '../../components/common/BottomSheet';
import { EmptyCartArt } from '../../components/illustrations';
import { fetchCatalogue, fetchAbonnementStatut } from '../../store/slices/marketplaceSlice';
import { ROUTES, productPath } from '../../routes';
import { annonceCover, formatMoney, personName } from '../../utils/marketplace';
import { loadJson, saveJson } from '../../store/persist';

const SEARCH_HISTORY_KEY = 'marketplace_search_history';

const SORTS = [
  { key: 'recent', label: 'Nouveautés' },
  { key: 'price_asc', label: 'Prix croissant' },
  { key: 'price_desc', label: 'Prix décroissant' },
];

const BANNERS = [
  {
    eyebrow: 'Vendeurs',
    title: 'Vendez en 2 minutes',
    text: 'Photos, prix, publiez. Votre article est en ligne.',
    cta: 'Vendre un article',
    to: ROUTES.MARKETPLACE_SELL,
    icon: Tag,
    className: 'shop-gradient',
    ctaClass: 'bg-shop-950 text-white',
  },
  {
    eyebrow: 'Livraison',
    title: 'On livre pour vous',
    text: 'Notre réseau de livreurs récupère et livre vos achats.',
    cta: 'Découvrir',
    to: ROUTES.MARKETPLACE_ORDERS,
    icon: Truck,
    className: 'brand-gradient',
    ctaClass: 'bg-white text-surface-900',
  },
  {
    eyebrow: 'Paiement',
    title: 'Payez le vendeur en direct',
    text: 'Mobile money ou cash à la livraison, sans intermédiaire.',
    cta: 'Mes achats',
    to: ROUTES.MARKETPLACE_ORDERS,
    icon: Wallet,
    className: 'bg-gradient-to-br from-navy-900 via-navy-700 to-primary-700 text-white',
    ctaClass: 'bg-shop-400 text-shop-950',
  },
];

const QUICK_LINKS = [
  { to: ROUTES.MARKETPLACE_ORDERS, icon: ShoppingBag, label: 'Mes achats', color: 'from-primary-400 to-primary-600 text-white shadow-brand' },
  { to: ROUTES.MARKETPLACE_FAVORITES, icon: Heart, label: 'Favoris', color: 'from-rose-400 to-red-500 text-white shadow-[0_8px_20px_-8px_rgba(239,68,68,0.6)]' },
  { to: ROUTES.MARKETPLACE_SELL, icon: Plus, label: 'Vendre', color: 'from-shop-300 to-shop-500 text-shop-950 shadow-[0_8px_20px_-8px_rgba(163,176,30,0.7)]' },
  { to: ROUTES.MARKETPLACE_SELLER, icon: Store, label: 'Ma boutique', color: 'from-navy-500 to-navy-700 text-white shadow-[0_8px_20px_-8px_rgba(54,48,101,0.6)]' },
];

const TRUST = [
  { icon: Truck, label: 'Livraison', sub: 'par nos livreurs', tint: 'bg-primary-100 text-primary-600' },
  { icon: Wallet, label: 'Paiement direct', sub: 'mobile money / cash', tint: 'bg-shop-100 text-shop-700' },
  { icon: ShieldCheck, label: 'Suivi', sub: 'de chaque commande', tint: 'bg-teal-100 text-teal-600' },
];

function useDebounced(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function PromoCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % BANNERS.length), 5000);
    return () => clearInterval(t);
  }, [paused]);

  const banner = BANNERS[index];

  return (
    <div className="relative" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div className="relative h-40 overflow-hidden rounded-[1.75rem] shadow-lg">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={index}
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0.5 }}
            transition={{ type: 'spring', stiffness: 260, damping: 32 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, { offset }) => {
              if (offset.x < -50) setIndex((i) => (i + 1) % BANNERS.length);
              if (offset.x > 50) setIndex((i) => (i - 1 + BANNERS.length) % BANNERS.length);
            }}
            className={`absolute inset-0 flex items-center gap-3 overflow-hidden p-5 ${banner.className}`}
          >
            <div className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full bg-white/15" />
            <div className="pointer-events-none absolute -bottom-14 right-20 h-28 w-28 rounded-full bg-white/10" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '14px 14px' }}
            />
            <div className="relative min-w-0 flex-1">
              <span className="inline-block rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">
                {banner.eyebrow}
              </span>
              <p className="mt-1.5 font-heading text-xl font-bold leading-tight">{banner.title}</p>
              <p className="mt-1 text-caption opacity-85">{banner.text}</p>
              <Link
                to={banner.to}
                className={`mt-3 inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-caption font-bold shadow-card transition active:scale-95 ${banner.ctaClass}`}
              >
                {banner.cta} <ChevronRight size={14} />
              </Link>
            </div>
            <motion.span
              initial={{ rotate: -12, scale: 0.8 }}
              animate={{ rotate: 6, scale: 1, y: [0, -4, 0] }}
              transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1, y: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
              className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white/25 shadow-lg ring-1 ring-white/30 backdrop-blur"
            >
              <banner.icon size={38} strokeWidth={1.8} />
            </motion.span>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {BANNERS.map((b, i) => (
          <button
            key={b.title}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Bannière ${i + 1}`}
            className="py-1"
          >
            <motion.span
              animate={{ width: i === index ? 20 : 6 }}
              className={`block h-1.5 rounded-full ${i === index ? 'bg-surface-800' : 'bg-surface-300'}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, subtitle, iconClass = 'bg-surface-100 text-surface-500' }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
        {createElement(icon, { size: 16 })}
      </span>
      <div className="min-w-0">
        <h2 className="text-title leading-tight text-surface-900">{title}</h2>
        {subtitle && <p className="truncate text-caption text-surface-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function TrustStrip() {
  return (
    <div className="grid grid-cols-3 divide-x divide-surface-100 rounded-2xl bg-white py-3 shadow-card ring-1 ring-surface-100">
      {TRUST.map((t) => (
        <div key={t.label} className="flex flex-col items-center gap-1 px-1 text-center">
          <span className={`icon-tile mb-0.5 h-9 w-9 rounded-xl ${t.tint}`}>
            <t.icon size={18} />
          </span>
          <p className="text-[12px] font-semibold leading-tight text-surface-800">{t.label}</p>
          <p className="text-[11px] leading-tight text-surface-500">{t.sub}</p>
        </div>
      ))}
    </div>
  );
}

// Rail horizontal des dernieres annonces publiees (premiere page du catalogue).
function FeaturedRail({ items, currentUserId }) {
  if (items.length < 4) return null;
  return (
    <section className="mt-6">
      <div className="page-container mb-3">
        <SectionTitle icon={Flame} title="À la une" subtitle="Les dernières pépites publiées" iconClass="bg-orange-50 text-orange-500" />
      </div>
      <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
        {items.slice(0, 8).map((a, i) => (
          <div key={a.id} className="w-40 shrink-0 snap-start">
            <ProductCard annonce={a} currentUserId={currentUserId} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentRail({ items }) {
  if (!items.length) return null;
  return (
    <section className="mt-6">
      <div className="page-container mb-3">
        <SectionTitle icon={History} title="Vus récemment" />
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="w-32 shrink-0"
          >
            <Link to={productPath(a.id)} className="group block overflow-hidden rounded-2xl bg-white shadow-card active:scale-[0.97]">
              <ProductImage src={a.photo} alt={a.titre} className="aspect-square" />
              <div className="p-2">
                <p className="truncate text-caption text-surface-600">{a.titre}</p>
                <p className="text-body font-bold text-surface-900">{formatMoney(a.prix, a.devise)}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function ProductRow({ annonce, currentUserId }) {
  const isOwn = currentUserId && annonce.vendeur?.id === currentUserId;
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Link
        to={productPath(annonce.id)}
        className="group flex gap-3 overflow-hidden rounded-2xl bg-white p-2.5 shadow-card transition hover:shadow-lg active:scale-[0.99]"
      >
        <ProductImage src={annonceCover(annonce)} alt={annonce.titre} className="h-28 w-28 shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col py-0.5">
          <p className="line-clamp-2 text-body font-medium text-surface-800">{annonce.titre}</p>
          {annonce.vendeur && <p className="mt-0.5 truncate text-caption text-surface-400">par {personName(annonce.vendeur)}</p>}
          {isOwn && <span className="mt-1 w-fit rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-semibold text-navy-700">Votre annonce</span>}
          <div className="mt-auto flex items-end justify-between">
            <p className="font-heading text-base font-bold text-surface-900">{formatMoney(annonce.prix, annonce.devise)}</p>
            <FavoriteButton annonce={annonce} className="h-8 w-8" size={15} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function ProductListPage() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const userId = useSelector((s) => s.auth.user?.id);
  const countryCode = useSelector((s) => s.country.code);
  const countryName = useSelector((s) => s.country.name);
  const { items, status, page, lastPage, total } = useSelector((s) => s.marketplace.catalogue);
  const recent = useSelector((s) => s.marketplace.recent);

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [searchFocused, setSearchFocused] = useState(false);
  const [history, setHistory] = useState(() => loadJson(SEARCH_HISTORY_KEY, []));
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState('grid');
  const [onlyMyCountry, setOnlyMyCountry] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [draftRange, setDraftRange] = useState(priceRange);
  const [compact, setCompact] = useState(false);
  const sentinelRef = useRef(null);

  const debounced = useDebounced(query);
  const codePays = onlyMyCountry ? countryCode : undefined;

  // Recherche serveur (titre OU description) des que la saisie se stabilise.
  useEffect(() => {
    if (!isAuthenticated) return;
    dispatch(fetchCatalogue({ recherche: debounced, page: 1, codePays }));
    setSearchParams(debounced.trim() ? { q: debounced.trim() } : {}, { replace: true });
  }, [debounced, codePays, isAuthenticated, dispatch, setSearchParams]);

  useEffect(() => {
    if (isAuthenticated) dispatch(fetchAbonnementStatut());
  }, [isAuthenticated, dispatch]);

  // En-tete compact au defilement.
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const hasMore = page < lastPage;
  const loadMore = useCallback(() => {
    if (status === 'idle' && hasMore) {
      dispatch(fetchCatalogue({ recherche: debounced, page: page + 1, codePays, append: true }));
    }
  }, [status, hasMore, page, debounced, codePays, dispatch]);

  // Scroll infini.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), { rootMargin: '400px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const commitSearch = (term) => {
    const t = term.trim();
    setQuery(t);
    setSearchFocused(false);
    if (!t) return;
    const next = [t, ...history.filter((h) => h.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    setHistory(next);
    saveJson(SEARCH_HISTORY_KEY, next);
  };

  // Tri et filtre prix appliques cote client sur les pages deja chargees
  // (l'API n'expose que `recherche` et `code_pays`).
  const visible = useMemo(() => {
    const min = Number(priceRange.min) || 0;
    const max = Number(priceRange.max) || Infinity;
    const list = items.filter((a) => Number(a.prix) >= min && Number(a.prix) <= max);
    if (sort === 'price_asc') return [...list].sort((a, b) => a.prix - b.prix);
    if (sort === 'price_desc') return [...list].sort((a, b) => b.prix - a.prix);
    return list;
  }, [items, sort, priceRange]);

  const priceFilterActive = Boolean(priceRange.min || priceRange.max);
  const loading = status === 'loading';
  const searching = Boolean(debounced.trim());

  return (
    <div className="pb-6">
      {/* En-tete marketplace */}
      <header className="sticky top-0 z-30">
        <div className={`shop-gradient safe-top relative transition-all duration-300 ${compact ? 'pb-3 shadow-lg' : 'pb-4'}`}>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/20" />
          </div>
          <div className="page-container relative">
            <AnimatePresence initial={false}>
              {!compact && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center justify-between pb-3 pt-4">
                    <div>
                      <h1 className="font-heading text-2xl font-bold leading-tight text-shop-950">Boutique</h1>
                      <p className="flex items-center gap-1.5 text-caption font-semibold text-shop-900">
                        <Truck size={14} strokeWidth={2.4} /> Livraison assurée par TourShop
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={ROUTES.MARKETPLACE_FAVORITES}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/50 text-shop-950 backdrop-blur transition hover:bg-white/70"
                        aria-label="Favoris"
                      >
                        <Heart size={19} />
                      </Link>
                      <CartButton />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className={`flex items-center gap-2 ${compact ? 'pt-3' : ''}`}>
              <form
                className="relative flex-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  commitSearch(query);
                  e.currentTarget.querySelector('input')?.blur();
                }}
              >
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                  placeholder="Rechercher un article…"
                  className="w-full rounded-full border-0 bg-white py-3 pl-10 pr-10 text-sm text-surface-900 shadow-card placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-shop-600"
                  enterKeyHint="search"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-surface-100 p-1 text-surface-500"
                    aria-label="Effacer"
                  >
                    <X size={14} />
                  </button>
                )}

                <AnimatePresence>
                  {searchFocused && history.length > 0 && !query && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl bg-white p-2 shadow-xl"
                    >
                      <div className="flex items-center justify-between px-2 pb-1">
                        <span className="text-caption font-semibold text-surface-500">Recherches récentes</span>
                        <button
                          type="button"
                          className="text-caption text-primary-600"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setHistory([]);
                            saveJson(SEARCH_HISTORY_KEY, []);
                          }}
                        >
                          Effacer
                        </button>
                      </div>
                      {history.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => commitSearch(h)}
                          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-body text-surface-700 hover:bg-surface-50"
                        >
                          <Clock size={14} className="text-surface-400" /> {h}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
              {compact && <CartButton />}
            </div>
          </div>
        </div>
      </header>

      {!isAuthenticated ? (
        <div className="page-container mt-4 space-y-5">
          <PromoCarousel />
          <GuestGate
            title="Découvrez l’e-commerce TourShop"
            description="Connectez-vous pour parcourir les articles, acheter et vendre entre particuliers."
          />
        </div>
      ) : (
        <>
          <div className="page-container mt-4 space-y-4">
            <AbonnementBanner />

            {!searching && (
              <>
                <PromoCarousel />
                <div className="grid grid-cols-4 gap-2 rounded-3xl bg-white p-3 shadow-card ring-1 ring-surface-100">
                  {QUICK_LINKS.map((l, i) => (
                    <motion.div key={l.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
                      <Link to={l.to} className="flex flex-col items-center gap-1.5 text-center transition active:scale-95">
                        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${l.color}`}>
                          <l.icon size={20} />
                        </span>
                        <span className="text-caption font-medium text-surface-700">{l.label}</span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
                <TrustStrip />
              </>
            )}
          </div>

          {!searching && !priceFilterActive && sort === 'recent' && (
            <FeaturedRail items={items} currentUserId={userId} />
          )}
          {!searching && <RecentRail items={recent} />}

          <section className="page-container mt-6">
            <div className="mb-3 flex items-end justify-between gap-2">
              <SectionTitle
                icon={searching ? Search : LayoutGrid}
                iconClass="bg-shop-100 text-shop-800"
                title={searching ? 'Résultats' : 'Tous les articles'}
                subtitle={loading ? 'Chargement…' : `${total} article${total > 1 ? 's' : ''}${searching ? ` pour « ${debounced.trim()} »` : ''}`}
              />
              <div className="flex rounded-full bg-white p-1 shadow-card">
                {[
                  { key: 'grid', icon: LayoutGrid, label: 'Grille' },
                  { key: 'list', icon: Rows3, label: 'Liste' },
                ].map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setView(v.key)}
                    aria-label={v.label}
                    aria-pressed={view === v.key}
                    className="relative rounded-full p-1.5"
                  >
                    {view === v.key && (
                      <motion.span layoutId="view-toggle" className="absolute inset-0 rounded-full bg-surface-900" />
                    )}
                    <v.icon size={16} className={`relative ${view === v.key ? 'text-white' : 'text-surface-500'}`} />
                  </button>
                ))}
              </div>
            </div>

            <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
              <button
                type="button"
                onClick={() => {
                  setDraftRange(priceRange);
                  setFiltersOpen(true);
                }}
                className={`chip ${priceFilterActive ? 'chip-active' : ''}`}
              >
                <SlidersHorizontal size={14} /> Prix
                {priceFilterActive && <span className="h-1.5 w-1.5 rounded-full bg-shop-600" />}
              </button>
              {countryCode && (
                <button
                  type="button"
                  onClick={() => setOnlyMyCountry((v) => !v)}
                  className={`chip ${onlyMyCountry ? 'chip-active' : ''}`}
                >
                  {onlyMyCountry ? <MapPin size={14} /> : <Globe2 size={14} />}
                  {onlyMyCountry ? countryName || countryCode : 'Tous les pays'}
                </button>
              )}
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  className={`chip ${sort === s.key ? 'chip-active' : ''}`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {loading && (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-card">
                <p className="text-body text-surface-600">Impossible de charger les articles.</p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => dispatch(fetchCatalogue({ recherche: debounced, page: 1, codePays }))}
                >
                  <RefreshCw size={16} /> Réessayer
                </button>
              </div>
            )}

            {!loading && status !== 'error' && visible.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center shadow-card"
              >
                <span className="animate-float">
                  <EmptyCartArt />
                </span>
                <div>
                  <p className="text-title text-surface-900">{searching || priceFilterActive ? 'Aucun résultat' : 'Aucun article pour le moment'}</p>
                  <p className="mt-1 text-body text-surface-500">
                    {searching || priceFilterActive
                      ? 'Essayez un autre mot-clé ou élargissez vos filtres.'
                      : 'Soyez le premier à publier un article.'}
                  </p>
                </div>
                {searching || priceFilterActive ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setQuery('');
                      setPriceRange({ min: '', max: '' });
                    }}
                  >
                    Réinitialiser
                  </button>
                ) : (
                  <Link to={ROUTES.MARKETPLACE_SELL} className="btn-shop">
                    <Tag size={16} /> Publier un article
                  </Link>
                )}
              </motion.div>
            )}

            {!loading && visible.length > 0 && (
              <motion.div layout className={view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2.5'}>
                {visible.map((annonce, i) =>
                  view === 'grid' ? (
                    <ProductCard key={annonce.id} annonce={annonce} currentUserId={userId} index={i} />
                  ) : (
                    <ProductRow key={annonce.id} annonce={annonce} currentUserId={userId} />
                  )
                )}
              </motion.div>
            )}

            {status === 'loadingMore' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <ProductCardSkeleton />
                <ProductCardSkeleton />
              </div>
            )}
            <div ref={sentinelRef} className="h-4" />
            {!loading && !hasMore && items.length > 0 && (
              <p className="flex items-center justify-center gap-2 py-4 text-caption text-surface-400">
                <ShieldCheck size={14} /> Vous avez tout vu
              </p>
            )}
          </section>

          {/* Bouton flottant "Vendre" */}
          <div className="pointer-events-none fixed bottom-[calc(theme(spacing.bottom-nav)+env(safe-area-inset-bottom)+1.5rem)] left-1/2 z-20 w-full max-w-md -translate-x-1/2 px-4">
            <div className="flex justify-end">
              <Link to={ROUTES.MARKETPLACE_SELL} className="pointer-events-auto">
                <motion.span
                  layout
                  whileTap={{ scale: 0.92 }}
                  className="flex items-center gap-2 rounded-full bg-surface-900 py-3.5 pl-4 text-white shadow-xl"
                  animate={{ paddingRight: compact ? 16 : 20 }}
                >
                  <Plus size={20} />
                  <AnimatePresence initial={false}>
                    {!compact && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 'auto', opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="overflow-hidden whitespace-nowrap text-sm font-semibold"
                      >
                        Vendre
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.span>
              </Link>
            </div>
          </div>
        </>
      )}

      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtrer par prix">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-caption font-medium text-surface-600">
              Minimum (FCFA)
              <input
                type="number"
                inputMode="numeric"
                min="0"
                className="input-field mt-1"
                value={draftRange.min}
                onChange={(e) => setDraftRange((r) => ({ ...r, min: e.target.value }))}
                placeholder="0"
              />
            </label>
            <label className="block text-caption font-medium text-surface-600">
              Maximum (FCFA)
              <input
                type="number"
                inputMode="numeric"
                min="0"
                className="input-field mt-1"
                value={draftRange.max}
                onChange={(e) => setDraftRange((r) => ({ ...r, max: e.target.value }))}
                placeholder="Illimité"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '< 10 000', min: '', max: '10000' },
              { label: '10 000 – 50 000', min: '10000', max: '50000' },
              { label: '50 000 – 200 000', min: '50000', max: '200000' },
              { label: '> 200 000', min: '200000', max: '' },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setDraftRange({ min: p.min, max: p.max })}
                className={`chip ${draftRange.min === p.min && draftRange.max === p.max ? 'chip-active' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => {
                setPriceRange({ min: '', max: '' });
                setFiltersOpen(false);
              }}
            >
              Effacer
            </button>
            <button
              type="button"
              className="btn-shop flex-1"
              onClick={() => {
                setPriceRange(draftRange);
                setFiltersOpen(false);
              }}
            >
              Appliquer
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
