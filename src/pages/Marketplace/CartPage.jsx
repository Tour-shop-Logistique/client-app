import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import EmptyState from '../../components/common/EmptyState';
import useRequireAuth from '../../hooks/useRequireAuth';
import marketplaceService from '../../services/marketplaceService';
import { updateQuantity, removeFromCart, clearCart } from '../../store/slices/cartSlice';
import { formatPrice } from '../../utils/format';

export default function CartPage() {
  const dispatch = useDispatch();
  const { requireAuth } = useRequireAuth();
  const items = useSelector((state) => state.cart.items);
  const [submitting, setSubmitting] = useState(false);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = () => {
    requireAuth(async () => {
      setSubmitting(true);
      try {
        await marketplaceService.checkout({
          items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
        });
        dispatch(clearCart());
        toast.success('Commande validee !');
      } catch (err) {
        toast.error(err.response?.data?.message || 'Impossible de valider la commande.');
      } finally {
        setSubmitting(false);
      }
    }, 'marketplace_order');
  };

  return (
    <div>
      <TopBar title="Mon panier" back />
      <div className="page-container py-4">
        {items.length === 0 && (
          <EmptyState icon={ShoppingBag} title="Panier vide" description="Ajoutez des articles depuis la marketplace." />
        )}

        {items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="card flex items-center gap-3 p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-100">
                  {item.image && <img src={item.image} alt={item.title} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-surface-900">{item.title}</p>
                  <p className="text-sm font-bold text-primary-700">{formatPrice(item.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-surface-200 p-1"
                    onClick={() => dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity - 1 }))}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    type="button"
                    className="rounded-full border border-surface-200 p-1"
                    onClick={() => dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity + 1 }))}
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    className="rounded-full p-1 text-red-500"
                    onClick={() => dispatch(removeFromCart(item.productId))}
                    aria-label="Retirer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            <div className="card p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-500">Total</span>
                <span className="text-lg font-bold text-surface-900">{formatPrice(total)}</span>
              </div>
            </div>

            <button type="button" className="btn-primary w-full" disabled={submitting} onClick={handleCheckout}>
              {submitting ? 'Validation...' : 'Valider la commande'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
