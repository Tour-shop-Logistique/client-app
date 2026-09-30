import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ShoppingCart } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ROUTES } from '../../routes';
import { selectCartCount } from '../../store/slices/cartSlice';

// Icone panier avec compteur anime ; cible de l'animation flyToCart.
export default function CartButton({ variant = 'light' }) {
  const count = useSelector(selectCartCount);
  const base =
    variant === 'glass'
      ? 'bg-white/20 text-white backdrop-blur hover:bg-white/30'
      : 'bg-white text-surface-800 shadow-card hover:bg-surface-50';

  return (
    <Link
      to={ROUTES.MARKETPLACE_CART}
      data-cart-target
      className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full transition ${base}`}
      aria-label={`Panier (${count} article${count > 1 ? 's' : ''})`}
    >
      <ShoppingCart size={19} />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-shop-400 px-1 text-[11px] font-bold text-shop-950 ring-2 ring-white"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
