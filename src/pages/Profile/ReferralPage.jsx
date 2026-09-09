import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { Share2, Copy, Gift, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import referralService from '../../services/referralService';
import { formatPrice, formatDate } from '../../utils/format';
import { ROUTES } from '../../routes';

// docs/api-parrainage-client.md — type_evenement is one of these (never
// `marketplace` for now). `expedition_nationale` == Interville.
const EVENT_LABELS = {
  expedition_internationale: 'Expédition internationale',
  expedition_nationale: 'Expédition nationale',
  enlevement_livraison: 'Enlèvement / livraison',
};

const fullName = (p) => [p?.nom, p?.prenoms].filter(Boolean).join(' ') || 'Filleul';

export default function ReferralPage() {
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const storedCode = useSelector((s) => s.auth.user?.code_parrainage || null);

  const [code, setCode] = useState(storedCode);
  const [solde, setSolde] = useState(null);
  const [filleuls, setFilleuls] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadHistory = useCallback(async (targetPage) => {
    const res = await referralService.getHistory(targetPage);
    const pager = res?.historique || {};
    setHistorique((prev) => (targetPage === 1 ? pager.data || [] : [...prev, ...(pager.data || [])]));
    setPage(pager.current_page || targetPage);
    setLastPage(pager.last_page || 1);
    setTotal(pager.total ?? 0);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      // Each call is independent — one failing must not blank the whole screen.
      const [codeRes, soldeRes, filleulsRes] = await Promise.allSettled([
        storedCode ? Promise.resolve({ code_parrainage: storedCode }) : referralService.getMyCode(),
        referralService.getBalance(),
        referralService.getReferees(),
      ]);
      if (cancelled) return;
      if (codeRes.status === 'fulfilled') setCode(codeRes.value?.code_parrainage || storedCode);
      if (soldeRes.status === 'fulfilled') setSolde(soldeRes.value?.solde_parrainage ?? 0);
      if (filleulsRes.status === 'fulfilled') setFilleuls(filleulsRes.value?.filleuls || []);

      try {
        await loadHistory(1);
      } catch {
        /* history stays empty */
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, storedCode, loadHistory]);

  if (!isAuthenticated) return <Navigate to={ROUTES.PROFILE} replace />;

  const shareText = code
    ? `Rejoins TourShop avec mon code de parrainage ${code} et bénéficie d'avantages sur tes expéditions !`
    : '';

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        toast.success('Message copié, partagez-le sur WhatsApp !');
      }
    } catch {
      /* user cancelled the share sheet */
    }
  };

  const handleCopyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success('Code copié.');
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await loadHistory(page + 1);
    } catch {
      toast.error('Impossible de charger la suite.');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <TopBar title="Parrainage" back />
      <div className="page-container py-4">
        {loading && <LoadingSpinner />}

        {!loading && (
          <div className="space-y-5">
            <div className="card bg-gradient-to-br from-amber-400 to-amber-500 p-5 text-white">
              <Gift size={22} />
              <p className="mt-3 text-sm text-amber-50">Votre code de parrainage</p>
              <p className="mt-1 text-2xl font-bold tracking-wide">{code || '—'}</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={handleCopyCode} disabled={!code} className="btn bg-white/20 text-white flex-1">
                  <Copy size={16} /> Copier
                </button>
                <button type="button" onClick={handleShare} disabled={!code} className="btn bg-white text-amber-700 flex-1">
                  <Share2 size={16} /> Partager
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <p className="flex items-center gap-1.5 text-xs text-surface-500">
                  <Wallet size={14} /> Solde des bonus
                </p>
                <p className="mt-1 text-xl font-bold text-primary-700">{formatPrice(solde ?? 0)}</p>
              </div>
              <div className="card p-4">
                <p className="flex items-center gap-1.5 text-xs text-surface-500">
                  <Users size={14} /> Filleuls
                </p>
                <p className="mt-1 text-xl font-bold text-surface-900">{filleuls.length}</p>
              </div>
            </div>

            <p className="text-xs text-surface-400">
              Un bonus vous est crédité automatiquement quand un filleul règle une expédition ou une
              livraison. Aucun retrait n'est disponible pour le moment.
            </p>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-surface-900">Mes filleuls</h2>
              {filleuls.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Aucun filleul pour l'instant"
                  description="Partagez votre code : vos filleuls apparaîtront ici dès leur inscription."
                />
              ) : (
                <div className="card divide-y divide-surface-100">
                  {filleuls.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-3.5">
                      <span className="text-sm font-medium text-surface-900">{fullName(f)}</span>
                      <span className="text-xs text-surface-400">Inscrit le {formatDate(f.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-surface-900">
                Historique des bonus{total > 0 ? ` (${total})` : ''}
              </h2>
              {historique.length === 0 ? (
                <EmptyState
                  icon={Gift}
                  title="Aucun bonus crédité"
                  description="Les bonus s'afficheront ici après la première activité payante d'un filleul."
                />
              ) : (
                <>
                  <div className="card divide-y divide-surface-100">
                    {historique.map((b) => (
                      <div key={b.id} className="flex items-start justify-between gap-3 p-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-surface-900">
                            {fullName(b.filleul)}
                          </p>
                          <p className="text-xs text-surface-500">
                            {EVENT_LABELS[b.type_evenement] || b.type_evenement} · taux {b.taux_applique}%
                          </p>
                          <p className="text-xs text-surface-400">{formatDate(b.created_at)}</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-primary-700">
                          +{formatPrice(b.montant_bonus)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {page < lastPage && (
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="btn-secondary mt-3 w-full"
                    >
                      {loadingMore ? 'Chargement…' : 'Charger plus'}
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
