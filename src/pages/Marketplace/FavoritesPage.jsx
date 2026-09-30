import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, ShoppingCart, Check, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import CartButton from '../../components/marketplace/CartButton';
import { ProductImage, FavoriteButton } from '../../components/marketplace/ProductCard';
import { addToCart } from '../../store/slices/cartSlice';
import { formatMoney } from '../../utils/marketplace';
import { ROUTES, productPath } from '../../routes';

// Favoris enregistres sur cet appareil (pas d'endpoint favoris cote API).
export default function FavoritesPage() {
  const dispatch = useDispatch();
  const favorites = useSelector((s) => s.marketplace.favorites);
  const cartItems = useSelector((s) => s.cart.items);
  const cartIds = useMemo(() => new Set(cartItems.map((i) => i.id)), [cartItems]);
  const userId = useSelector((s) => s.auth.user?.id);

  return (
    <div>
      <TopBar title={`Favoris${favorites.length ? ` (${favorites.length})` : ''}`} back right={<CartButton />} />
      <div className="page-container py-4">
        {favorites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center shadow-card"
          >
            <motion.span
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500"
            >
              <Heart size={30} />
            </motion.span>
            <p className="text-title text-surface-900">Aucun favori</p>
            <p className="text-body text-surface-500">Touchez le cœur d’un article pour le retrouver ici.</p>
            <Link to={ROUTES.MARKETPLACE} className="btn-shop">
              Explorer <ArrowRight size={16} />
            </Link>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-2 gap-3">
            <AnimatePresence>
              {favorites.map((f) => {
                const inCart = cartIds.has(f.id);
                const own = userId && f.vendeur?.id === userId;
                return (
                  <motion.div
                    key={f.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="overflow-hidden rounded-2xl bg-white shadow-card"
                  >
                    <Link to={productPath(f.id)} className="group relative block">
                      <ProductImage src={f.photo} alt={f.titre} className="aspect-[4/5]" />
                      <FavoriteButton annonce={f} className="absolute right-2 top-2" />
                    </Link>
                    <div className="space-y-2 p-3">
                      <div>
                        <p className="font-heading text-[15px] font-bold text-surface-900">{formatMoney(f.prix, f.devise)}</p>
                        <p className="truncate text-caption text-surface-600">{f.titre}</p>
                      </div>
                      {!own && (
                        <button
                          type="button"
                          disabled={inCart}
                          onClick={() => {
                            dispatch(addToCart(f));
                            toast.success('Ajouté au panier');
                          }}
                          className={`btn w-full py-2 text-caption ${inCart ? 'bg-emerald-50 text-emerald-700' : 'bg-shop-400 text-shop-950 hover:bg-shop-300'}`}
                        >
                          {inCart ? <Check size={14} /> : <ShoppingCart size={14} />}
                          {inCart ? 'Dans le panier' : 'Ajouter'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
