import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import marketplaceService from '../../services/marketplaceService';
import { addToCart } from '../../store/slices/cartSlice';
import { formatPrice } from '../../utils/format';

export default function ProductDetailPage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    marketplaceService
      .getProduct(id)
      .then((data) => active && setProduct(data))
      .catch(() => active && setProduct(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const handleAddToCart = () => {
    dispatch(
      addToCart({
        productId: product.id,
        title: product.titre || product.title,
        price: product.prix || product.price,
        image: product.photo,
      })
    );
    toast.success('Ajoute au panier.');
  };

  return (
    <div>
      <TopBar title="Article" back />
      {loading && <LoadingSpinner />}

      {!loading && !product && (
        <div className="page-container py-4 text-sm text-surface-500">Article introuvable.</div>
      )}

      {!loading && product && (
        <div>
          <div className="aspect-square w-full bg-surface-100">
            {product.photo && <img src={product.photo} alt={product.titre} className="h-full w-full object-cover" />}
          </div>
          <div className="page-container space-y-3 py-4">
            <h1 className="text-lg font-bold text-surface-900">{product.titre || product.title}</h1>
            <p className="text-xl font-bold text-primary-700">{formatPrice(product.prix || product.price)}</p>
            <p className="text-sm text-surface-600">{product.description}</p>

            <button type="button" className="btn-primary w-full" onClick={handleAddToCart}>
              <ShoppingCart size={16} /> Ajouter au panier
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
