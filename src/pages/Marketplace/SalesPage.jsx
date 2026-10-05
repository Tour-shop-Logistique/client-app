import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Receipt, ChevronRight, Hourglass, Truck } from 'lucide-react';
import TopBar from '../../components/common/TopBar';
import SegmentedTabs from '../../components/marketplace/SegmentedTabs';
import StatusBadge from '../../components/marketplace/StatusBadge';
import AbonnementBanner from '../../components/marketplace/AbonnementBanner';
import useMarketplaceError from '../../hooks/useMarketplaceError';
import marketplaceService from '../../services/marketplaceService';
import { useRealtimeMarketplace } from '../../hooks/useRealtimeUpdates';
import {
  COMMANDE_STATUTS, LIVRAISON_STATUTS, formatMoney, personName, isLivraisonActive,
} from '../../utils/marketplace';
import { formatDate } from '../../utils/format';
import { salePath } from '../../routes';
import { OrderListSkeleton } from './OrdersPage';
import { EmptyReceiptArt } from '../../components/illustrations';

// A expedier : payee, sans livreur actif (jamais choisi, ou refus/expiration).
const needsShipping = (c) => c.statut === 'payee' && c.mode_livraison !== 'hors_plateforme' && !isLivraisonActive(c.livraison_marketplace);

const TABS = [
  { key: 'all', label: 'Toutes', match: () => true },
  { key: 'confirm', label: 'À confirmer', match: (c) => c.statut === 'paiement_a_confirmer' },
  { key: 'ship', label: 'À expédier', match: needsShipping },
  { key: 'transit', label: 'En livraison', match: (c) => c.statut === 'payee' && !needsShipping(c) },
  { key: 'wait', label: 'Paiement attendu', match: (c) => c.statut === 'en_attente_paiement' },
  { key: 'done', label: 'Livrées', match: (c) => c.statut === 'livree' },
  { key: 'cancel', label: 'Annulées', match: (c) => c.statut === 'annulee' },
];

export default function SalesPage() {
  const handleError = useMarketplaceError();
  const [params, setParams] = useSearchParams();
  const [ventes, setVentes] = useState(null);
  const tab = TABS.some((t) => t.key === params.get('onglet')) ? params.get('onglet') : 'all';

  const load = useCallback(() => {
    marketplaceService
      .mesVentes()
      .then(setVentes)
      .catch((err) => {
        setVentes([]);
        handleError(err, 'Impossible de charger vos ventes.');
      });
  }, [handleError]);

  useEffect(() => {
    load();
  }, [load]);

  // Nouvelle commande, paiement declare, livreur qui accepte/refuse… : liste a jour.
  useRealtimeMarketplace(null, load);

  const tabs = useMemo(
    () => TABS.map((t) => ({ ...t, count: t.key === 'all' ? 0 : (ventes ?? []).filter(t.match).length })),
    [ventes]
  );
  const visible = (ventes ?? []).filter(TABS.find((t) => t.key === tab).match);

  return (
    <div>
      <TopBar title="Mes ventes" back />
      <div className="page-container space-y-4 py-4">
        <AbonnementBanner />
        <SegmentedTabs tabs={tabs} value={tab} onChange={(k) => setParams(k === 'all' ? {} : { onglet: k }, { replace: true })} id="sales" />

        {ventes === null && <OrderListSkeleton />}

        {ventes !== null && visible.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center shadow-card">
            <span className="animate-float">
              <EmptyReceiptArt />
            </span>
            <p className="text-title text-surface-900">{tab === 'all' ? 'Aucune vente pour le moment' : 'Rien à traiter ici'}</p>
            <p className="text-body text-surface-500">Les commandes de vos acheteurs apparaîtront ici.</p>
          </div>
        )}

        <motion.ul layout className="space-y-3">
          <AnimatePresence initial={false}>
            {visible.map((c, i) => {
              const action =
                c.statut === 'paiement_a_confirmer'
                  ? { icon: Hourglass, text: 'Confirmer le paiement', cls: 'bg-primary-600 text-white' }
                  : needsShipping(c)
                    ? { icon: Truck, text: 'Choisir la livraison', cls: 'bg-shop-400 text-shop-950' }
                    : null;
              return (
                <motion.li key={c.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }} exit={{ opacity: 0 }}>
                  <Link to={salePath(c.id)} className="block rounded-2xl bg-white p-4 shadow-card transition hover:shadow-lg active:scale-[0.99]">
                    <div className="flex items-start gap-3">
                      <span className="icon-tile h-11 w-11 rounded-[14px] bg-primary-100 text-primary-600">
                        <Receipt size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-body font-semibold text-surface-900">
                          {c.items?.map((it) => it.titre_snapshot).join(', ') || 'Commande'}
                        </p>
                        <p className="mt-0.5 text-caption text-surface-400">
                          {c.acheteur ? `Acheteur : ${personName(c.acheteur)}` : ''}
                          {c.created_at ? ` · ${formatDate(c.created_at)}` : ''}
                        </p>
                      </div>
                      <StatusBadge map={COMMANDE_STATUTS} value={c.statut} short />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-surface-100 pt-3">
                      <p className="font-heading text-lg font-bold text-surface-900">{formatMoney(c.montant_articles)}</p>
                      {action ? (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-bold ${action.cls}`}>
                          <action.icon size={13} /> {action.text}
                        </span>
                      ) : c.livraison_marketplace?.statut ? (
                        <StatusBadge map={LIVRAISON_STATUTS} value={c.livraison_marketplace.statut} />
                      ) : (
                        <ChevronRight size={18} className="text-surface-300" />
                      )}
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      </div>
    </div>
  );
}
