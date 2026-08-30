import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Search, ShoppingCart, PlusCircle, PackageSearch } from 'lucide-react';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { fetchProducts } from '../../store/slices/marketplaceSlice';
import { formatPrice } from '../../utils/format';
import { ROUTES, productPath } from '../../routes';

export default function ProductListPage() {
  const dispatch = useDispatch();
  const { products, status } = useSelector((state) => state.marketplace);
  const cartCount = useSelector((state) => state.cart.items.reduce((n, i) => n + i.quantity, 0));
  const [query, setQuery] = useState('');

  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);

  const filtered = products.filter((p) =>
    (p.titre || p.title || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <TopBar
        title="Marketplace"
        right={
          <Link to={ROUTES.MARKETPLACE_CART} className="relative rounded-full bg-white p-2 text-surface-700 shadow-card">
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
        }
      />
      <div className="page-container py-4">
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              className="input-field pl-9"
              placeholder="Rechercher un produit"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Link to={ROUTES.MARKETPLACE_SELL} className="btn-primary px-3" aria-label="Vendre un produit">
            <PlusCircle size={18} />
          </Link>
        </div>

        {status === 'loading' && <LoadingSpinner label="Chargement des articles..." />}

        {status !== 'loading' && filtered.length === 0 && (
          <EmptyState
            icon={PackageSearch}
            title="Aucun article trouve"
            description="Soyez le premier a publier un article sur la marketplace."
            action={
              <Link to={ROUTES.MARKETPLACE_SELL} className="btn-primary">
                Publier un article
              </Link>
            }
          />
        )}

        {status !== 'loading' && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((product) => (
              <Link key={product.id} to={productPath(product.id)} className="card overflow-hidden">
                <div className="aspect-square bg-surface-100">
                  {product.photo && (
                    <img src={product.photo} alt={product.titre} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-surface-900">{product.titre || product.title}</p>
                  <p className="text-sm font-bold text-primary-700">{formatPrice(product.prix || product.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
