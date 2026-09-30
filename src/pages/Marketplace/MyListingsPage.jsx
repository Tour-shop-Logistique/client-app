import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Tag, Plus, Rocket, EyeOff, Pencil, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import SegmentedTabs from '../../components/marketplace/SegmentedTabs';
import StatusBadge from '../../components/marketplace/StatusBadge';
import { ProductImage } from '../../components/marketplace/ProductCard';
import AbonnementBanner from '../../components/marketplace/AbonnementBanner';
import useMarketplaceError from '../../hooks/useMarketplaceError';
import marketplaceService from '../../services/marketplaceService';
import { ANNONCE_STATUTS, annonceCover, formatMoney } from '../../utils/marketplace';
import { formatDate } from '../../utils/format';
import { ROUTES, listingEditPath, productPath } from '../../routes';

const TABS = [
  { key: 'all', label: 'Toutes' },
  { key: 'publiee', label: 'En ligne' },
  { key: 'brouillon', label: 'Brouillons' },
  { key: 'depubliee', label: 'Dépubliées' },
  { key: 'vendue', label: 'Vendues' },
  { key: 'masquee', label: 'Masquées' },
];

function ListingCard({ annonce, busy, onPublish, onUnpublish }) {
  const canPublish = annonce.statut === 'brouillon' || annonce.statut === 'depubliee';
  const canEdit = annonce.statut !== 'vendue';
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="overflow-hidden rounded-2xl bg-white shadow-card"
    >
      <div className="flex gap-3 p-3">
        <ProductImage src={annonceCover(annonce)} alt={annonce.titre} className={`h-24 w-24 shrink-0 rounded-xl ${annonce.statut === 'vendue' ? 'grayscale' : ''}`} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-body font-semibold text-surface-900">{annonce.titre}</p>
          </div>
          <p className="mt-0.5 font-heading text-base font-bold text-surface-900">{formatMoney(annonce.prix, annonce.devise)}</p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <StatusBadge map={ANNONCE_STATUTS} value={annonce.statut} />
            <span className="text-[11px] text-surface-400">
              {annonce.vendue_le
                ? `Vendue ${formatDate(annonce.vendue_le)}`
                : annonce.publiee_le
                  ? `Publiée ${formatDate(annonce.publiee_le)}`
                  : `Créée ${formatDate(annonce.created_at)}`}
            </span>
          </div>
        </div>
      </div>
      {annonce.statut === 'masquee' && (
        <p className="border-t border-surface-100 bg-red-50 px-3 py-2 text-caption text-red-700">
          Cette annonce a été masquée par la modération et n’est plus visible.
        </p>
      )}
      {annonce.statut !== 'vendue' && annonce.statut !== 'masquee' && (
        <div className="flex divide-x divide-surface-100 border-t border-surface-100">
          {canPublish && (
            <button type="button" disabled={busy} onClick={onPublish} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-caption font-semibold text-shop-800 transition hover:bg-shop-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />} Publier
            </button>
          )}
          {annonce.statut === 'publiee' && (
            <>
              <Link to={productPath(annonce.id)} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-caption font-semibold text-surface-700 transition hover:bg-surface-50">
                <ExternalLink size={14} /> Voir
              </Link>
              <button type="button" disabled={busy} onClick={onUnpublish} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-caption font-semibold text-amber-700 transition hover:bg-amber-50">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />} Retirer
              </button>
            </>
          )}
          {canEdit && (
            <Link to={listingEditPath(annonce.id)} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-caption font-semibold text-primary-700 transition hover:bg-primary-50">
              <Pencil size={14} /> Modifier
            </Link>
          )}
        </div>
      )}
    </motion.li>
  );
}

export default function MyListingsPage() {
  const handleError = useMarketplaceError();
  const [annonces, setAnnonces] = useState(null);
  const [tab, setTab] = useState('all');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setAnnonces(null);
    marketplaceService
      .mesAnnonces()
      .then(setAnnonces)
      .catch((err) => {
        setAnnonces([]);
        handleError(err, 'Impossible de charger vos annonces.');
      });
  }, [handleError]);

  useEffect(() => {
    load();
  }, [load]);

  const tabs = useMemo(
    () =>
      TABS.map((t) => ({ ...t, count: t.key === 'all' ? 0 : (annonces ?? []).filter((a) => a.statut === t.key).length })).filter(
        (t) => t.key === 'all' || t.key === 'publiee' || t.key === 'brouillon' || t.count > 0
      ),
    [annonces]
  );
  const visible = (annonces ?? []).filter((a) => tab === 'all' || a.statut === tab);

  const act = async (annonce, action) => {
    setBusyId(annonce.id);
    try {
      const updated = action === 'publish' ? await marketplaceService.publierAnnonce(annonce.id) : await marketplaceService.depublierAnnonce(annonce.id);
      setAnnonces((list) => list.map((a) => (a.id === annonce.id ? { ...a, ...updated } : a)));
      toast.success(action === 'publish' ? 'Annonce publiée' : 'Annonce retirée du catalogue');
    } catch (err) {
      handleError(err, 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <TopBar
        title="Mes annonces"
        back
        right={
          <Link to={ROUTES.MARKETPLACE_SELL} className="inline-flex items-center gap-1 rounded-full bg-shop-400 px-3 py-1.5 text-caption font-bold text-shop-950">
            <Plus size={15} /> Nouvelle
          </Link>
        }
      />
      <div className="page-container space-y-4 py-4">
        <AbonnementBanner />
        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} id="listings" />

        {annonces === null && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-white shadow-card" />
            ))}
          </div>
        )}

        {annonces !== null && visible.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center shadow-card">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-shop-100 text-shop-800">
              <Tag size={28} />
            </span>
            <p className="text-title text-surface-900">{tab === 'all' ? 'Aucune annonce' : 'Rien dans cette catégorie'}</p>
            {tab === 'all' ? (
              <Link to={ROUTES.MARKETPLACE_SELL} className="btn-shop">
                <Plus size={16} /> Publier mon premier article
              </Link>
            ) : (
              <button type="button" onClick={load} className="btn-secondary">
                <RefreshCw size={15} /> Actualiser
              </button>
            )}
          </div>
        )}

        <motion.ul layout className="space-y-3">
          <AnimatePresence initial={false}>
            {visible.map((a) => (
              <ListingCard
                key={a.id}
                annonce={a}
                busy={busyId === a.id}
                onPublish={() => act(a, 'publish')}
                onUnpublish={() => act(a, 'unpublish')}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      </div>
    </div>
  );
}
