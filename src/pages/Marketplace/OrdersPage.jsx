import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag, ChevronRight, Wallet, KeyRound, RefreshCw, ArrowRight } from 'lucide-react';
import TopBar from '../../components/common/TopBar';
import SegmentedTabs from '../../components/marketplace/SegmentedTabs';
import StatusBadge from '../../components/marketplace/StatusBadge';
import GuestGate from '../../components/marketplace/GuestGate';
import marketplaceService from '../../services/marketplaceService';
import { COMMANDE_STATUTS, formatMoney, personName } from '../../utils/marketplace';
import { formatDate } from '../../utils/format';
import { ROUTES, orderPath } from '../../routes';

const TABS = [
  { key: 'all', label: 'Toutes', match: () => true },
  { key: 'pay', label: 'À payer', match: (c) => c.statut === 'en_attente_paiement' },
  { key: 'confirm', label: 'En vérification', match: (c) => c.statut === 'paiement_a_confirmer' },
  { key: 'ship', label: 'En livraison', match: (c) => c.statut === 'payee' },
  { key: 'done', label: 'Livrées', match: (c) => c.statut === 'livree' },
];

export function OrderListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-white shadow-card" />
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const [commandes, setCommandes] = useState(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState('all');

  const load = useCallback(() => {
    setError(false);
    marketplaceService
      .mesAchats()
      .then(setCommandes)
      .catch(() => {
        setCommandes([]);
        setError(true);
      });
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  const tabs = useMemo(
    () => TABS.map((t) => ({ ...t, count: t.key === 'all' ? 0 : (commandes ?? []).filter(t.match).length })),
    [commandes]
  );
  const visible = (commandes ?? []).filter(TABS.find((t) => t.key === tab).match);

  return (
    <div>
      <TopBar title="Mes achats" back />
      <div className="page-container space-y-4 py-4">
        {!isAuthenticated ? (
          <GuestGate />
        ) : (
          <>
            <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} id="orders" />

            {commandes === null && <OrderListSkeleton />}

            {error && (
              <button type="button" onClick={load} className="btn-secondary w-full">
                <RefreshCw size={16} /> Réessayer
              </button>
            )}

            {commandes !== null && !error && visible.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center shadow-card">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                  <ShoppingBag size={28} />
                </span>
                <p className="text-title text-surface-900">{tab === 'all' ? 'Aucun achat pour l’instant' : 'Rien ici'}</p>
                {tab === 'all' && (
                  <Link to={ROUTES.MARKETPLACE} className="btn-shop">
                    Découvrir les articles <ArrowRight size={16} />
                  </Link>
                )}
              </div>
            )}

            <motion.ul layout className="space-y-3">
              <AnimatePresence initial={false}>
                {visible.map((c, i) => (
                  <motion.li
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                    exit={{ opacity: 0, scale: 0.96 }}
                  >
                    <Link to={orderPath(c.id)} className="block rounded-2xl bg-white p-4 shadow-card transition hover:shadow-lg active:scale-[0.99]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-body font-semibold text-surface-900">
                            {c.items?.map((it) => it.titre_snapshot).join(', ') || 'Commande'}
                          </p>
                          <p className="mt-0.5 text-caption text-surface-400">
                            {c.vendeur ? `Vendeur : ${personName(c.vendeur)}` : ''}
                            {c.created_at ? ` · ${formatDate(c.created_at)}` : ''}
                          </p>
                        </div>
                        <StatusBadge map={COMMANDE_STATUTS} value={c.statut} short />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="font-heading text-lg font-bold text-surface-900">{formatMoney(c.montant_articles)}</p>
                        {c.statut === 'en_attente_paiement' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-shop-400 px-3 py-1.5 text-caption font-bold text-shop-950">
                            <Wallet size={13} /> Déclarer le paiement
                          </span>
                        ) : c.code_validation_livraison && c.statut !== 'livree' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1.5 text-caption font-bold text-navy-700">
                            <KeyRound size={13} /> Code {c.code_validation_livraison}
                          </span>
                        ) : (
                          <ChevronRight size={18} className="text-surface-300" />
                        )}
                      </div>
                    </Link>
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          </>
        )}
      </div>
    </div>
  );
}
