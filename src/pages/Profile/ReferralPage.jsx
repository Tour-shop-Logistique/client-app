import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { Share2, Copy, Gift, Users, Wallet, Info } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { GiftArt } from '../../components/illustrations';
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
const initialsOf = (p) =>
  [p?.prenoms, p?.nom].filter(Boolean).map((s) => s.trim()[0]).join('').slice(0, 2).toUpperCase() || 'F';

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
            <div className="relative overflow-hidden rounded-3xl bg-navy-800 p-5 text-white">
              <div className="pointer-events-none absolute -bottom-12 -right-10 h-44 w-44 rounded-full bg-shop-400/15" />
              <GiftArt className="pointer-events-none absolute -right-1 top-3 animate-float" />
              <span className="relative inline-block rounded-full bg-shop-400 px-2.5 py-0.5 text-[11px] font-bold text-shop-950">Parrainage</span>
              <p className="relative mt-2 w-44 font-heading text-lg font-semibold leading-6">Invitez vos proches, gagnez des bonus</p>
              <div className="relative mt-4 rounded-2xl border-2 border-dashed border-white/30 bg-white/10 px-4 py-3">
                <p className="text-caption text-white/80">Votre code</p>
                <p className="font-heading text-2xl font-bold tracking-[0.15em]">{code || '—'}</p>
              </div>
              <div className="relative mt-3 flex gap-2">
                <button type="button" onClick={handleCopyCode} disabled={!code} className="btn flex-1 bg-white/15 text-white">
                  <Copy size={16} /> Copier
                </button>
                <button type="button" onClick={handleShare} disabled={!code} className="btn-shop flex-1">
                  <Share2 size={16} /> Partager
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="card flex items-center gap-3 p-4">
                <span className="icon-tile h-11 w-11 rounded-[14px] bg-shop-100 text-shop-700">
                  <Wallet size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-caption text-surface-500">Solde des bonus</p>
                  <p className="truncate font-heading text-lg font-bold text-surface-900">{formatPrice(solde ?? 0)}</p>
                </div>
              </div>
              <div className="card flex items-center gap-3 p-4">
                <span className="icon-tile h-11 w-11 rounded-[14px] bg-primary-100 text-primary-600">
                  <Users size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-caption text-surface-500">Filleuls</p>
                  <p className="font-heading text-lg font-bold text-surface-900">{filleuls.length}</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-2xl bg-primary-50 p-3.5 text-body text-surface-600">
              <Info size={17} className="mt-0.5 shrink-0 text-primary-600" />
              <p>
                Un bonus vous est crédité automatiquement quand un filleul règle une expédition ou une
                livraison. Aucun retrait n'est disponible pour le moment.
              </p>
            </div>

            <section>
              <h2 className="mb-2.5 font-heading text-[17px] font-semibold text-surface-900">Mes filleuls</h2>
              {filleuls.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Aucun filleul pour l'instant"
                  description="Partagez votre code : vos filleuls apparaîtront ici dès leur inscription."
                />
              ) : (
                <div className="card divide-y divide-surface-100">
                  {filleuls.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 p-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-teal-500 text-caption font-bold text-white">
                        {initialsOf(f)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-surface-900">{fullName(f)}</span>
                        <span className="block text-caption text-surface-500">Inscrit le {formatDate(f.created_at)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-2.5 font-heading text-[17px] font-semibold text-surface-900">
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
                      <div key={b.id} className="flex items-start gap-3 p-3.5">
                        <span className="icon-tile h-10 w-10 rounded-[13px] bg-shop-100 text-shop-700">
                          <Gift size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-surface-900">
                            {fullName(b.filleul)}
                          </p>
                          <p className="text-xs text-surface-500">
                            {EVENT_LABELS[b.type_evenement] || b.type_evenement} · taux {b.taux_applique}%
                          </p>
                          <p className="text-xs text-surface-400">{formatDate(b.created_at)}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-700">
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
