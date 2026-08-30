import { useMemo, useState } from 'react';
import { Search, PackageSearch } from 'lucide-react';
import BottomSheet from '../common/BottomSheet';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';

export default function ProductSelectSheet({ open, onClose, products, status, onSelect }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.designation.toLowerCase().includes(q));
  }, [products, query]);

  return (
    <BottomSheet open={open} onClose={onClose} title="Ajouter un produit">
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          className="input-field pl-9"
          placeholder="Rechercher un produit"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {status === 'loading' && <LoadingSpinner label="Chargement des produits..." />}

      {status === 'error' && (
        <EmptyState
          icon={PackageSearch}
          title="Impossible de charger les produits"
          description="Verifiez votre connexion puis reessayez."
        />
      )}

      {status === 'idle' && (
        <div className="max-h-[60dvh] divide-y divide-surface-100 overflow-y-auto rounded-xl border border-surface-100">
          {filtered.length === 0 && (
            <p className="p-4 text-center text-sm text-surface-500">Aucun produit trouve.</p>
          )}
          {filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                onSelect(product);
                onClose();
              }}
              className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-surface-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-surface-900">{product.designation}</p>
                <p className="truncate text-xs text-surface-500">{product.category?.nom}</p>
              </div>
              <span className="shrink-0 rounded-full bg-surface-100 px-2 py-0.5 text-xs font-medium text-surface-600">
                {product.reference}
              </span>
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
