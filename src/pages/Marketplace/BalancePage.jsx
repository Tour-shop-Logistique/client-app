import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, Info, ArrowDownLeft, Receipt } from 'lucide-react';
import TopBar from '../../components/common/TopBar';
import AnimatedNumber from '../../components/marketplace/AnimatedNumber';
import marketplaceService from '../../services/marketplaceService';
import { formatMoney } from '../../utils/marketplace';
import { formatDateTime } from '../../utils/format';
import { salePath } from '../../routes';

// Solde purement informatif (section 8) : jamais d'argent detenu, aucun retrait.
export default function BalancePage() {
  const [solde, setSolde] = useState(null);
  const [historique, setHistorique] = useState(null);

  useEffect(() => {
    marketplaceService.solde().then(setSolde).catch(() => setSolde(0));
    marketplaceService.soldeHistorique().then(setHistorique).catch(() => setHistorique([]));
  }, []);

  const totalVentes = (historique ?? []).reduce((s, h) => s + Number(h.detail?.montant_vente ?? 0), 0);
  const totalCommission = (historique ?? []).reduce((s, h) => s + Number(h.detail?.montant_commission ?? 0), 0);

  return (
    <div>
      <TopBar title="Solde & historique" back />
      <div className="page-container space-y-4 py-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="brand-gradient relative overflow-hidden rounded-3xl p-5"
        >
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
          <p className="flex items-center gap-1.5 text-caption text-white/80">
            <TrendingUp size={14} /> Ventes cumulées (net)
          </p>
          <p className="mt-1 font-heading text-[34px] font-bold leading-tight">
            {solde === null ? '…' : <AnimatedNumber value={solde} format={(n) => formatMoney(n)} />}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3 text-caption">
            <div>
              <p className="text-white/70">Ventes brutes</p>
              <p className="text-body font-semibold">{formatMoney(totalVentes)}</p>
            </div>
            <div>
              <p className="text-white/70">Commissions</p>
              <p className="text-body font-semibold">{formatMoney(totalCommission)}</p>
            </div>
          </div>
        </motion.div>

        <div className="flex gap-2.5 rounded-2xl bg-surface-100 p-3.5 text-caption text-surface-600">
          <Info size={16} className="mt-0.5 shrink-0" />
          Ce montant est indicatif : vos acheteurs vous paient directement. TourShop ne détient pas cet argent et il n’y a rien à retirer.
        </div>

        <section>
          <h2 className="mb-2 text-body font-semibold text-surface-900">Historique</h2>
          {historique === null && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-white shadow-card" />
              ))}
            </div>
          )}
          {historique?.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-white py-10 text-center shadow-card">
              <Receipt size={26} className="text-surface-300" />
              <p className="text-body text-surface-500">Vos ventes livrées apparaîtront ici.</p>
            </div>
          )}
          <ul className="space-y-2">
            {historique?.map((h, i) => (
              <motion.li key={h.detail?.id ?? i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link
                  to={h.detail?.commande_marketplace_id ? salePath(h.detail.commande_marketplace_id) : '#'}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-card"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <ArrowDownLeft size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium text-surface-900">Vente livrée</p>
                    <p className="text-caption text-surface-400">
                      {formatDateTime(h.date)} · commission {h.detail?.taux_commission ?? '–'} %
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-body font-bold text-emerald-600">+{formatMoney(h.montant)}</p>
                    {h.detail?.montant_vente != null && (
                      <p className="text-[11px] text-surface-400 line-through">{formatMoney(h.detail.montant_vente)}</p>
                    )}
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
