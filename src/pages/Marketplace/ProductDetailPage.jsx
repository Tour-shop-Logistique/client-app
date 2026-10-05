import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft, Share2, ShoppingCart, Zap, Check, Wallet, Smartphone, Banknote, Truck, KeyRound,
  ShieldCheck, ChevronDown, Settings2, CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import ImageGallery from '../../components/marketplace/ImageGallery';
import CartButton from '../../components/marketplace/CartButton';
import { FavoriteButton, ProductImage } from '../../components/marketplace/ProductCard';
import GuestGate from '../../components/marketplace/GuestGate';
import flyToCart from '../../components/marketplace/flyToCart';
import marketplaceService from '../../services/marketplaceService';
import { addToCart, selectInCart } from '../../store/slices/cartSlice';
import { annonceSnapshot, pushRecent } from '../../store/slices/marketplaceSlice';
import {
  annoncePhotos, formatMoney, personName, initials, PAYMENT_METHODS,
} from '../../utils/marketplace';
import { formatDate } from '../../utils/format';
import { ROUTES, productPath, listingEditPath } from '../../routes';
import { EmptyParcelArt } from '../../components/illustrations';

const METHOD_ICONS = { mobile_money: Smartphone, cash: Banknote };

const HOW_IT_WORKS = [
  { icon: ShoppingCart, title: 'Commandez', text: 'Ajoutez l’article au panier et validez votre commande.' },
  { icon: Wallet, title: 'Payez le vendeur', text: 'Mobile money ou cash, directement au vendeur, puis déclarez votre paiement.' },
  { icon: Truck, title: 'Faites-vous livrer', text: 'Le vendeur confie la livraison à un livreur ou livre lui-même.' },
  { icon: KeyRound, title: 'Donnez le code', text: 'Remettez votre code à 4 chiffres au livreur à la réception.' },
];

function DetailSkeleton() {
  return (
    <div>
      <div className="aspect-square w-full skeleton" />
      <div className="page-container space-y-3 py-5">
        <div className="h-7 w-32 skeleton rounded" />
        <div className="h-4 w-full skeleton rounded" />
        <div className="h-4 w-2/3 skeleton rounded" />
        <div className="h-20 w-full skeleton rounded-2xl" />
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const catalogueItems = useSelector((s) => s.marketplace.catalogue.items);
  const inCart = useSelector(selectInCart(id));
  const heroRef = useRef(null);

  const [state, setState] = useState({ loading: true, annonce: null, own: false });
  const [moyens, setMoyens] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let active = true;
    setState({ loading: true, annonce: null, own: false });
    setMoyens(null);
    window.scrollTo({ top: 0 });
    marketplaceService
      .catalogueShow(id)
      .then(({ annonce, est_ma_propre_annonce: own }) => {
        if (!active) return;
        setState({ loading: false, annonce, own: Boolean(own) });
        dispatch(pushRecent(annonceSnapshot(annonce)));
        if (annonce.vendeur?.id) {
          marketplaceService
            .vendeurMoyensPaiement(annonce.vendeur.id)
            .then((list) => active && setMoyens(list))
            .catch(() => active && setMoyens([]));
        }
      })
      .catch(() => active && setState({ loading: false, annonce: null, own: false }));
    return () => {
      active = false;
    };
  }, [id, isAuthenticated, dispatch]);

  const { annonce, own, loading } = state;
  const photos = useMemo(() => annoncePhotos(annonce), [annonce]);

  // Autres articles deja charges : d'abord ceux du meme vendeur.
  const related = useMemo(() => {
    if (!annonce) return [];
    const others = catalogueItems.filter((a) => a.id !== annonce.id);
    const sameSeller = others.filter((a) => a.vendeur?.id === annonce.vendeur?.id);
    const rest = others.filter((a) => a.vendeur?.id !== annonce.vendeur?.id);
    return [...sameSeller, ...rest].slice(0, 10);
  }, [catalogueItems, annonce]);

  const handleAdd = (buyNow = false) => {
    if (!inCart) {
      if (!buyNow) flyToCart(heroRef.current?.querySelector('img'));
      dispatch(addToCart(annonceSnapshot(annonce)));
      if (!buyNow) toast.success('Ajouté au panier', { description: annonce.titre });
    }
    if (buyNow) navigate(ROUTES.MARKETPLACE_CART);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: annonce.titre, text: `${annonce.titre} — ${formatMoney(annonce.prix, annonce.devise)}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Lien copié');
      }
    } catch {
      /* partage annule */
    }
  };

  const floatingBar = (
    <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-surface-800 shadow-card backdrop-blur"
        aria-label="Retour"
      >
        <ChevronLeft size={22} />
      </button>
      {annonce && (
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-surface-800 shadow-card backdrop-blur"
            aria-label="Partager"
          >
            <Share2 size={17} />
          </button>
          <FavoriteButton annonce={annonce} className="h-10 w-10" size={18} />
          <CartButton />
        </div>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="relative">
        <div className="h-16">{floatingBar}</div>
        <div className="page-container py-4">
          <GuestGate />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="relative">
        {floatingBar}
        <DetailSkeleton />
      </div>
    );
  }

  if (!annonce) {
    return (
      <div className="relative">
        <div className="h-16">{floatingBar}</div>
        <div className="page-container flex flex-col items-center gap-3 py-16 text-center">
          <span className="animate-float">
            <EmptyParcelArt />
          </span>
          <p className="text-title text-surface-900">Article indisponible</p>
          <p className="text-body text-surface-500">Cet article a peut-être été vendu ou retiré par le vendeur.</p>
          <Link to={ROUTES.MARKETPLACE} className="btn-shop mt-2">
            Continuer mes achats
          </Link>
        </div>
      </div>
    );
  }

  const description = annonce.description || '';
  const longDescription = description.length > 220;

  return (
    <div className="relative pb-24">
      <div ref={heroRef} className="relative">
        <ImageGallery photos={photos} overlay={floatingBar} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="page-container space-y-4 pt-4"
      >
        <div>
          <p className="font-heading text-[26px] font-bold leading-tight text-surface-900">
            {formatMoney(annonce.prix, annonce.devise)}
          </p>
          <h1 className="mt-1 text-lg font-medium leading-snug text-surface-800">{annonce.titre}</h1>
          {annonce.publiee_le && (
            <p className="mt-1.5 flex items-center gap-1.5 text-caption text-surface-400">
              <CalendarDays size={13} /> Publié le {formatDate(annonce.publiee_le)}
            </p>
          )}
        </div>

        {own && (
          <div className="flex items-center gap-3 rounded-2xl bg-navy-50 p-3.5 text-navy-800">
            <ShieldCheck size={20} className="shrink-0" />
            <p className="flex-1 text-body">C’est votre annonce : voici comment les acheteurs la voient.</p>
            <Link to={listingEditPath(annonce.id)} className="shrink-0 rounded-full bg-navy-700 px-3 py-1.5 text-caption font-semibold text-white">
              Gérer
            </Link>
          </div>
        )}

        {/* Garanties */}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {[
            { icon: Wallet, text: 'Paiement direct au vendeur' },
            { icon: Truck, text: 'Livraison par nos livreurs' },
            { icon: KeyRound, text: 'Remise sécurisée par code' },
          ].map((g) => (
            <span key={g.text} className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-caption font-medium text-surface-700 shadow-card">
              <g.icon size={15} className="text-shop-700" /> {g.text}
            </span>
          ))}
        </div>

        {/* Vendeur */}
        {annonce.vendeur && (
          <div className="card flex items-center gap-3 p-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-shop-300 to-teal-400 font-heading text-base font-bold text-shop-950">
              {initials(annonce.vendeur)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-caption text-surface-400">Vendu par</p>
              <p className="truncate font-semibold text-surface-900">{personName(annonce.vendeur)}</p>
            </div>
          </div>
        )}

        {/* Description */}
        {description && (
          <section className="card p-4">
            <h2 className="mb-2 text-body font-semibold text-surface-900">Description</h2>
            <motion.div
              initial={false}
              animate={{ height: expanded || !longDescription ? 'auto' : 96 }}
              className="relative overflow-hidden"
            >
              <p className="whitespace-pre-line text-body text-surface-600">{description}</p>
              {longDescription && !expanded && (
                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white" />
              )}
            </motion.div>
            {longDescription && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-caption font-semibold text-primary-600">
                {expanded ? 'Voir moins' : 'Voir plus'}
              </button>
            )}
          </section>
        )}

        {/* Moyens de paiement acceptes */}
        <section className="card p-4">
          <h2 className="mb-3 text-body font-semibold text-surface-900">Paiements acceptés par le vendeur</h2>
          {moyens === null ? (
            <div className="h-10 skeleton rounded-xl" />
          ) : moyens.length === 0 ? (
            <p className="text-caption text-surface-500">Le vendeur n’a pas encore indiqué ses moyens de paiement. Vous pourrez les voir au moment de payer.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {moyens.map((m) => {
                const Icon = METHOD_ICONS[m.methode] ?? Wallet;
                return (
                  <span key={m.id} className="inline-flex items-center gap-2 rounded-xl bg-surface-50 px-3 py-2 text-caption font-medium text-surface-700 ring-1 ring-surface-100">
                    <Icon size={15} className="text-shop-700" />
                    {m.libelle || PAYMENT_METHODS[m.methode] || m.methode}
                  </span>
                );
              })}
            </div>
          )}
        </section>

        {/* Comment ca marche */}
        <section className="card overflow-hidden">
          <button type="button" onClick={() => setHowOpen((v) => !v)} className="flex w-full items-center justify-between p-4">
            <span className="text-body font-semibold text-surface-900">Comment se passe l’achat ?</span>
            <motion.span animate={{ rotate: howOpen ? 180 : 0 }}>
              <ChevronDown size={18} className="text-surface-400" />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {howOpen && (
              <motion.ol
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 overflow-hidden px-4 pb-4"
              >
                {HOW_IT_WORKS.map((step, i) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-shop-100 text-shop-800">
                      <step.icon size={17} />
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface-900 text-[10px] font-bold text-white">
                        {i + 1}
                      </span>
                    </span>
                    <div>
                      <p className="text-body font-semibold text-surface-900">{step.title}</p>
                      <p className="text-caption text-surface-500">{step.text}</p>
                    </div>
                  </li>
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </section>
      </motion.div>

      {related.length > 0 && (
        <section className="mt-6">
          <h2 className="page-container mb-2.5 text-title text-surface-900">Vous aimerez aussi</h2>
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
            {related.map((a) => (
              <Link key={a.id} to={productPath(a.id)} className="group w-36 shrink-0 overflow-hidden rounded-2xl bg-white shadow-card active:scale-[0.97]">
                <ProductImage src={annoncePhotos(a)[0]?.url} alt={a.titre} className="aspect-square" />
                <div className="p-2.5">
                  <p className="text-body font-bold text-surface-900">{formatMoney(a.prix, a.devise)}</p>
                  <p className="truncate text-caption text-surface-500">{a.titre}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Barre d'achat collante (au-dessus de la barre de navigation) */}
      <div className="fixed inset-x-0 bottom-[calc(theme(spacing.bottom-nav)+env(safe-area-inset-bottom)+0.75rem)] z-20">
        <div className="mx-auto max-w-md border-t border-surface-100 bg-white/95 px-4 py-3 backdrop-blur">
          {own ? (
            <Link to={listingEditPath(annonce.id)} className="btn-secondary w-full">
              <Settings2 size={16} /> Gérer mon annonce
            </Link>
          ) : (
            <div className="flex gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => (inCart ? navigate(ROUTES.MARKETPLACE_CART) : handleAdd(false))}
                className={`btn flex-1 border ${inCart ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-surface-200 bg-white text-surface-900'}`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={String(inCart)}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -10, opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    {inCart ? <Check size={16} /> : <ShoppingCart size={16} />}
                    {inCart ? 'Voir le panier' : 'Au panier'}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
              <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => handleAdd(true)} className="btn-shop flex-1">
                <Zap size={16} /> Acheter
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
