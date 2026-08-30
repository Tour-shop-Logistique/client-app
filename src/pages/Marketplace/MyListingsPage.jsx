import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag, PlusCircle } from 'lucide-react';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import marketplaceService from '../../services/marketplaceService';
import { formatPrice } from '../../utils/format';
import { ROUTES } from '../../routes';

export default function MyListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    marketplaceService
      .myListings()
      .then((data) => setListings(data.data ?? data))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <TopBar
        title="Mes annonces"
        back
        right={
          <Link to={ROUTES.MARKETPLACE_SELL} className="rounded-full bg-primary-600 p-2 text-white">
            <PlusCircle size={18} />
          </Link>
        }
      />
      <div className="page-container py-4">
        {loading && <LoadingSpinner />}

        {!loading && listings.length === 0 && (
          <EmptyState
            icon={Tag}
            title="Aucune annonce publiee"
            description="Publiez votre premier article pour commencer a vendre."
            action={
              <Link to={ROUTES.MARKETPLACE_SELL} className="btn-primary">
                Publier un article
              </Link>
            }
          />
        )}

        {!loading && listings.length > 0 && (
          <div className="space-y-3">
            {listings.map((item) => (
              <div key={item.id} className="card flex items-center gap-3 p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-100">
                  {item.photo && <img src={item.photo} alt={item.titre} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-surface-900">{item.titre}</p>
                  <p className="text-sm font-bold text-primary-700">{formatPrice(item.prix)}</p>
                </div>
                <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-600">
                  {item.statut || 'en ligne'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
