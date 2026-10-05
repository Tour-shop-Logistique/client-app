import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Trash2, Store, Info, ShieldCheck, ArrowRight, Heart, Loader2, CheckCircle2, Wallet, AlertCircle, MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import BottomSheet from '../../components/common/BottomSheet';
import { ProductImage } from '../../components/marketplace/ProductCard';
import AddressFields from '../../components/marketplace/AddressFields';
import { EmptyCartArt } from '../../components/illustrations';
import useRequireAuth from '../../hooks/useRequireAuth';
import marketplaceService from '../../services/marketplaceService';
import { removeFromCart, removeManyFromCart, clearCart } from '../../store/slices/cartSlice';
import { dropFromCatalogue } from '../../store/slices/marketplaceSlice';
import {
  formatMoney, personName, initials, apiErrorMessage, EMPTY_ADDRESS,
} from '../../utils/marketplace';
import { ROUTES, productPath, orderPath } from '../../routes';

// Derniere adresse de livraison utilisee, pre-remplie au prochain achat.
const ADDRESS_KEY = 'marketplace_adresse_livraison';
const loadAddress = () => {
  try {
    return JSON.parse(localStorage.getItem(ADDRESS_KEY)) || null;
  } catch {
    return null;
  }
};
const saveAddress = (addr) => {
  try {
    localStorage.setItem(ADDRESS_KEY, JSON.stringify(addr));
  } catch {
    // non bloquant
  }
};

const REQUIRED_ADDRESS = ['nom', 'telephone', 'adresse', 'ville'];

const addressErrors = (addr) =>
  Object.fromEntries(REQUIRED_ADDRESS.filter((k) => !String(addr[k] ?? '').trim()).map((k) => [k, 'Champ requis']));

// Corps `adresse_livraison` de panier/valider (champs optionnels omis si vides).
const toAdresseLivraison = (addr) => {
  const out = {};
  ['nom', 'telephone', 'adresse', 'ville', 'quartier', 'instructions'].forEach((k) => {
    const v = String(addr[k] ?? '').trim();
    if (v) out[k] = v;
  });
  if (addr.latitude != null && addr.longitude != null) {
    out.latitude = addr.latitude;
    out.longitude = addr.longitude;
  }
  return out;
};

// Ligne de panier, glisser vers la gauche pour supprimer.
function CartLine({ item, own, unavailable, onRemove }) {
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-120, -40, 0], [1, 0.6, 0]);

  return (
    <motion.li layout exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }} className="relative overflow-hidden">
      <motion.div style={{ opacity: bgOpacity }} className="absolute inset-0 flex items-center justify-end bg-red-500 pr-5 text-white">
        <Trash2 size={20} />
      </motion.div>
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        onDragEnd={(_, info) => info.offset.x < -110 && onRemove()}
        className="relative flex items-center gap-3 bg-white p-3"
      >
        <Link to={productPath(item.id)} className="shrink-0">
          <ProductImage src={item.photo} alt={item.titre} className={`h-20 w-20 rounded-xl ${unavailable ? 'grayscale' : ''}`} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={productPath(item.id)} className="line-clamp-2 text-body font-medium text-surface-800">
            {item.titre}
          </Link>
          <p className="mt-1 font-heading text-base font-bold text-surface-900">{formatMoney(item.prix, item.devise)}</p>
          {own && (
            <p className="mt-0.5 flex items-center gap-1 text-caption font-medium text-amber-700">
              <AlertCircle size={12} /> Votre propre annonce
            </p>
          )}
          {unavailable && (
            <p className="mt-0.5 flex items-center gap-1 text-caption font-medium text-red-600">
              <AlertCircle size={12} /> Plus disponible
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="self-start rounded-full p-2 text-surface-400 transition hover:bg-red-50 hover:text-red-500"
          aria-label="Retirer du panier"
        >
          <Trash2 size={17} />
        </button>
      </motion.div>
    </motion.li>
  );
}

export default function CartPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { requireAuth } = useRequireAuth();
  const items = useSelector((s) => s.cart.items);
  const user = useSelector((s) => s.auth.user);
  const userId = user?.id;
  const favorites = useSelector((s) => s.marketplace.favorites);
  const [submitting, setSubmitting] = useState(false);
  const [unavailable, setUnavailable] = useState(() => new Set());
  const [createdOrders, setCreatedOrders] = useState(null);
  const [addressOpen, setAddressOpen] = useState(false);
  const [address, setAddress] = useState(() => loadAddress() || EMPTY_ADDRESS);
  const [addrErrors, setAddrErrors] = useState({});

  // Le serveur cree une commande par vendeur : on presente le panier ainsi.
  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = item.vendeur?.id ?? 'inconnu';
      if (!map.has(key)) map.set(key, { vendeur: item.vendeur, items: [] });
      map.get(key).items.push(item);
    });
    return [...map.values()];
  }, [items]);

  const isOwn = (item) => Boolean(userId && item.vendeur?.id === userId);
  const purchasable = items.filter((i) => !isOwn(i) && !unavailable.has(i.id));
  const total = purchasable.reduce((sum, i) => sum + Number(i.prix), 0);
  const blocked = items.length > purchasable.length;

  // 1. Connexion si besoin, puis saisie de l'adresse de livraison (requise).
  const handleCheckout = () => {
    requireAuth(() => {
      if (!purchasable.length) return;
      setAddress((a) => ({
        ...a,
        nom: a.nom || (user ? personName(user) : ''),
        telephone: a.telephone || user?.telephone || '',
      }));
      setAddrErrors({});
      setAddressOpen(true);
    }, 'marketplace_order');
  };

  // 2. Validation du panier avec l'adresse (une seule pour toutes les commandes).
  const submitOrder = async () => {
    const errs = addressErrors(address);
    setAddrErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      const commandes = await marketplaceService.validerPanier(purchasable.map((i) => i.id), toAdresseLivraison(address));
      saveAddress(address);
      const ids = purchasable.map((i) => i.id);
      dispatch(removeManyFromCart(ids));
      dispatch(dropFromCatalogue(ids));
      setAddressOpen(false);
      setCreatedOrders(commandes);
    } catch (err) {
      // Erreurs Laravel `adresse_livraison.ville` -> champ correspondant.
      const fieldErrs = Object.entries(err?.response?.data?.errors ?? {})
        .filter(([k]) => k.startsWith('adresse_livraison.'))
        .map(([k, v]) => [k.replace('adresse_livraison.', ''), [v].flat()[0]]);
      if (fieldErrs.length) {
        setAddrErrors(Object.fromEntries(fieldErrs));
        return;
      }
      const message = apiErrorMessage(err, 'Impossible de valider le panier.');
      // "Article(s) déjà vendu(s) ou indisponible(s) : A, B" -> on marque ces lignes.
      const titles = message.includes(':') ? message.split(':').slice(1).join(':').split(',').map((t) => t.trim()) : [];
      const hit = items.filter((i) => titles.includes(i.titre)).map((i) => i.id);
      if (hit.length) {
        setUnavailable((prev) => new Set([...prev, ...hit]));
        setAddressOpen(false);
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <TopBar
        title={`Mon panier${items.length ? ` (${items.length})` : ''}`}
        back
        right={
          items.length > 0 && (
            <button
              type="button"
              className="text-caption font-semibold text-red-600"
              onClick={() => {
                dispatch(clearCart());
                setUnavailable(new Set());
              }}
            >
              Vider
            </button>
          )
        }
      />

      <div className="page-container py-4">
        {items.length === 0 && !createdOrders && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center shadow-card">
              <motion.span
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                className="animate-float"
              >
                <EmptyCartArt />
              </motion.span>
              <div>
                <p className="text-title text-surface-900">Votre panier est vide</p>
                <p className="mt-1 text-body text-surface-500">Découvrez les articles mis en vente près de chez vous.</p>
              </div>
              <Link to={ROUTES.MARKETPLACE} className="btn-shop">
                Explorer les articles <ArrowRight size={16} />
              </Link>
            </div>
            {favorites.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-2 text-body font-semibold text-surface-900">
                  <Heart size={16} className="text-red-500" /> Dans vos favoris
                </p>
                <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
                  {favorites.slice(0, 8).map((f) => (
                    <Link key={f.id} to={productPath(f.id)} className="w-32 shrink-0 overflow-hidden rounded-2xl bg-white shadow-card">
                      <ProductImage src={f.photo} alt={f.titre} className="aspect-square" />
                      <div className="p-2">
                        <p className="truncate text-caption text-surface-600">{f.titre}</p>
                        <p className="text-body font-bold">{formatMoney(f.prix, f.devise)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {items.length > 0 && (
          <div className="space-y-4 pb-36">
            {groups.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2.5 rounded-2xl bg-primary-50 p-3.5 text-primary-800"
              >
                <Info size={18} className="mt-0.5 shrink-0" />
                <p className="text-caption">
                  Votre panier contient des articles de <strong>{groups.length} vendeurs</strong> : {groups.length} commandes
                  seront créées, à régler séparément auprès de chaque vendeur.
                </p>
              </motion.div>
            )}

            {groups.map((group, gi) => {
              const subtotal = group.items.filter((i) => !isOwn(i) && !unavailable.has(i.id)).reduce((s, i) => s + Number(i.prix), 0);
              return (
                <motion.section
                  key={group.vendeur?.id ?? gi}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.06 }}
                  className="overflow-hidden rounded-2xl bg-white shadow-card"
                >
                  <header className="flex items-center gap-2.5 border-b border-surface-100 px-4 py-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-shop-300 to-teal-400 text-caption font-bold text-shop-950">
                      {group.vendeur ? initials(group.vendeur) : <Store size={14} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-semibold text-surface-900">
                        {group.vendeur ? personName(group.vendeur) : 'Vendeur'}
                      </p>
                      <p className="text-caption text-surface-400">
                        {group.items.length} article{group.items.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <p className="text-body font-bold text-surface-900">{formatMoney(subtotal)}</p>
                  </header>
                  <ul className="divide-y divide-surface-100">
                    <AnimatePresence initial={false}>
                      {group.items.map((item) => (
                        <CartLine
                          key={item.id}
                          item={item}
                          own={isOwn(item)}
                          unavailable={unavailable.has(item.id)}
                          onRemove={() => dispatch(removeFromCart(item.id))}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                </motion.section>
              );
            })}

            <p className="text-center text-caption text-surface-400">Astuce : glissez un article vers la gauche pour le retirer.</p>

            <div className="card space-y-2.5 p-4">
              <div className="flex justify-between text-body text-surface-600">
                <span>Articles ({purchasable.length})</span>
                <span>{formatMoney(total)}</span>
              </div>
              <div className="flex justify-between text-body text-surface-600">
                <span>Livraison</span>
                <span className="text-caption">Fixée par le vendeur après paiement</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-surface-200 pt-2.5">
                <span className="font-semibold text-surface-900">Total articles</span>
                <span className="font-heading text-lg font-bold text-surface-900">{formatMoney(total)}</span>
              </div>
            </div>

            <div className="flex gap-2.5 rounded-2xl bg-white p-3.5 text-surface-600 shadow-card">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
              <p className="text-caption">
                Aucun paiement n’est prélevé ici. Après validation, vous payez chaque vendeur directement (mobile money ou cash)
                puis vous déclarez votre paiement.
              </p>
            </div>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(theme(spacing.bottom-nav)+env(safe-area-inset-bottom)+0.75rem)] z-20">
          <div className="mx-auto max-w-md border-t border-surface-100 bg-white/95 px-4 py-3 backdrop-blur">
            {blocked && (
              <p className="mb-2 text-center text-caption text-amber-700">
                Les articles marqués ne seront pas commandés.
              </p>
            )}
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="btn-shop w-full py-3.5 text-base"
              disabled={purchasable.length === 0}
              onClick={handleCheckout}
            >
              <ShieldCheck size={18} />
              {`Valider la commande · ${formatMoney(total)}`}
            </motion.button>
          </div>
        </div>
      )}

      {/* Adresse de livraison (requise par panier/valider) */}
      <BottomSheet open={addressOpen} onClose={() => !submitting && setAddressOpen(false)} title="Adresse de livraison">
        <div className="space-y-4">
          <p className="flex gap-2 text-caption text-surface-500">
            <MapPin size={15} className="mt-0.5 shrink-0 text-shop-700" />
            Le livreur vous apportera {groups.length > 1 ? 'toutes vos commandes' : 'votre commande'} à cette adresse.
          </p>
          <AddressFields
            value={address}
            onChange={(a) => {
              setAddress(a);
              if (Object.keys(addrErrors).length) setAddrErrors({});
            }}
            required={REQUIRED_ADDRESS}
            errors={addrErrors}
            withInstructions
            idPrefix="livraison"
          />
          <motion.button type="button" whileTap={{ scale: 0.97 }} className="btn-shop w-full py-3.5" disabled={submitting} onClick={submitOrder}>
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {submitting ? 'Validation…' : `Confirmer la commande · ${formatMoney(total)}`}
          </motion.button>
        </div>
      </BottomSheet>

      {/* Confirmation : une commande par vendeur, chacune a payer */}
      <BottomSheet open={Boolean(createdOrders)} onClose={() => navigate(ROUTES.MARKETPLACE_ORDERS)} title="Commande validée">
        {createdOrders && (
          <div className="space-y-4">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <CheckCircle2 size={56} className="text-emerald-500" />
              <p className="text-body text-surface-600">
                {createdOrders.length > 1
                  ? `${createdOrders.length} commandes ont été créées, une par vendeur.`
                  : 'Votre commande a été créée.'}{' '}
                Payez le vendeur puis déclarez votre paiement.
              </p>
            </motion.div>
            <ul className="space-y-2">
              {createdOrders.map((c, i) => (
                <motion.li key={c.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }}>
                  <Link to={orderPath(c.id)} className="flex items-center gap-3 rounded-2xl border border-surface-200 p-3 transition hover:border-shop-400">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-shop-100 text-shop-800">
                      <Wallet size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-semibold text-surface-900">
                        {c.items?.map((it) => it.titre_snapshot).join(', ') || 'Commande'}
                      </p>
                      <p className="text-caption text-surface-500">{formatMoney(c.montant_articles)}</p>
                    </div>
                    <span className="rounded-full bg-surface-900 px-3 py-1.5 text-caption font-semibold text-white">Payer</span>
                  </Link>
                </motion.li>
              ))}
            </ul>
            <Link to={ROUTES.MARKETPLACE_ORDERS} className="btn-secondary w-full">
              Voir mes achats
            </Link>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
