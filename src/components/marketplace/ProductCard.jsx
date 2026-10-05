import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Heart, Plus, Check, ShoppingBag, Images, Eye, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { productPath } from '../../routes';
import { addToCart, selectInCart } from '../../store/slices/cartSlice';
import { toggleFavorite, annonceSnapshot } from '../../store/slices/marketplaceSlice';
import { annonceCover, formatMoney, personName, initials, storageUrl, handleMediaError, isNewAnnonce } from '../../utils/marketplace';
import flyToCart from './flyToCart';

// Image produit : normalise l'URL (y compris les anciennes URLs persistees),
// tente l'URL de secours puis affiche un placeholder soigne si tout echoue.
export function ProductImage({ src, alt, className = '', imgRef }) {
  const url = storageUrl(src);
  const [state, setState] = useState({ url, loaded: false, failed: false });
  const current = state.url === url ? state : { url, loaded: false, failed: false };

  if (!url || current.failed) {
    return (
      <div className={`relative flex flex-col items-center justify-center gap-1.5 overflow-hidden bg-gradient-to-br from-shop-50 via-surface-50 to-surface-100 text-surface-300 ${className}`}>
        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-shop-100/70" />
        <ShoppingBag size={28} strokeWidth={1.5} className="relative" />
        {alt && <span className="relative line-clamp-1 max-w-[80%] text-[11px] font-medium text-surface-400">{alt}</span>}
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden bg-surface-100 ${className}`}>
      {!current.loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-100 to-surface-200" />}
      <img
        ref={imgRef}
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setState({ url, loaded: true, failed: false })}
        onError={(e) => {
          if (!handleMediaError(e)) setState({ url, loaded: false, failed: true });
        }}
        className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${current.loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}

export function FavoriteButton({ annonce, className = '', size = 16 }) {
  const dispatch = useDispatch();
  const active = useSelector((s) => s.marketplace.favorites.some((f) => f.id === annonce.id));

  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(toggleFavorite(annonce.photo !== undefined ? annonce : annonceSnapshot(annonce)));
    if (!active) toast.success('Ajouté aux favoris', { duration: 1500 });
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.8 }}
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-card backdrop-blur transition ${className}`}
    >
      <motion.span key={String(active)} initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 15 }}>
        <Heart size={size} className={active ? 'fill-red-500 text-red-500' : 'text-surface-600'} />
      </motion.span>
    </motion.button>
  );
}

// Carte produit du catalogue. `currentUserId` desactive l'achat sur ses propres
// annonces (le serveur refuse aussi l'auto-achat a panier/valider).
export default function ProductCard({ annonce, currentUserId, index = 0 }) {
  const dispatch = useDispatch();
  const imgRef = useRef(null);
  const inCart = useSelector(selectInCart(annonce.id));
  const isOwn = Boolean(currentUserId && annonce.vendeur?.id === currentUserId);
  const cover = annonceCover(annonce);
  const photoCount = annonce.photos?.length ?? 0;
  const isNew = isNewAnnonce(annonce);

  const onAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOwn || inCart) return;
    flyToCart(imgRef.current);
    dispatch(addToCart(annonceSnapshot(annonce)));
    toast.success('Ajouté au panier', { description: annonce.titre, duration: 1800 });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index % 20, 8) * 0.04 }}
    >
      <Link
        to={productPath(annonce.id)}
        className="group block overflow-hidden rounded-[1.25rem] bg-white shadow-card ring-1 ring-surface-100 transition duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]"
      >
        <div className="relative m-1.5 overflow-hidden rounded-2xl">
          <ProductImage src={cover} alt={annonce.titre} className="aspect-[4/5]" imgRef={imgRef} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />

          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {isOwn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-navy-800/85 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                <Eye size={11} /> Votre annonce
              </span>
            )}
            {isNew && !isOwn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-shop-400 px-2 py-0.5 text-[11px] font-bold text-shop-950 shadow-sm">
                <Sparkles size={11} /> Nouveau
              </span>
            )}
          </div>
          <FavoriteButton annonce={annonce} className="absolute right-2 top-2" />

          {photoCount > 1 && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
              <Images size={11} /> {photoCount}
            </span>
          )}

          {!isOwn && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              onClick={onAdd}
              aria-label={inCart ? 'Déjà dans le panier' : 'Ajouter au panier'}
              className={`absolute bottom-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full shadow-lg ring-2 ring-white/70 transition ${
                inCart ? 'bg-emerald-500 text-white' : 'bg-shop-400 text-shop-950 hover:bg-shop-300'
              }`}
            >
              {inCart ? <Check size={18} strokeWidth={3} /> : <Plus size={20} strokeWidth={2.6} />}
            </motion.button>
          )}
        </div>

        <div className="px-3 pb-3 pt-1.5">
          <p className="line-clamp-2 min-h-[2.5rem] text-body font-medium text-surface-800">{annonce.titre}</p>
          <p className="mt-1 font-heading text-base font-bold tracking-tight text-surface-900">
            {formatMoney(annonce.prix, annonce.devise)}
          </p>
          {annonce.vendeur && (
            <div className="mt-2 flex items-center gap-1.5 border-t border-surface-100 pt-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-teal-500 text-[9px] font-bold text-white">
                {initials(annonce.vendeur)}
              </span>
              <p className="truncate text-caption text-surface-500">{personName(annonce.vendeur)}</p>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.25rem] bg-white shadow-card ring-1 ring-surface-100">
      <div className="m-1.5 aspect-[4/5] skeleton rounded-2xl" />
      <div className="space-y-2 px-3 pb-3 pt-1.5">
        <div className="h-3 w-full skeleton rounded" />
        <div className="h-3 w-2/3 skeleton rounded" />
        <div className="h-4 w-20 skeleton rounded" />
      </div>
    </div>
  );
}
