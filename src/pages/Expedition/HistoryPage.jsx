import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Package, Plus, RefreshCw, ChevronRight, ArrowRight } from 'lucide-react';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { fetchExpeditions, fetchExpeditionStats } from '../../store/slices/expeditionSlice';
import { openAuthSheet } from '../../store/slices/uiSlice';
import { formatDate, formatPrice } from '../../utils/format';
import { getStatutMeta, getTypeLabel, STATUS_FILTERS } from '../../utils/expeditionStatus';
import { ROUTES, expeditionDetailPath } from '../../routes';

const villeDepart = (exp) =>
  exp.expediteur?.ville || exp.expediteur_ville || exp.ville_depart || exp.agence?.ville || exp.code_pays_depart || '—';
const villeDestination = (exp) =>
  exp.destinataire?.ville || exp.destinataire_ville || exp.ville_destination || exp.code_pays_destination || '—';

function StatCards({ stats }) {
  if (!stats) return null;
  const cells = [
    { label: 'Total', value: stats.total ?? 0 },
    { label: 'En attente', value: stats.en_attente ?? 0 },
    { label: 'En cours', value: stats.en_cours ?? 0 },
    { label: 'Terminées', value: stats.termined ?? 0 },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map((c) => (
        <div key={c.label} className="rounded-2xl bg-white p-2.5 text-center shadow-card">
          <p className="text-xl font-bold text-surface-900">{c.value}</p>
          <p className="text-[10px] font-medium uppercase tracking-wide leading-tight text-surface-400">
            {c.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function ExpeditionCard({ exp }) {
  const statut = getStatutMeta(exp.statut_expedition);
  const nbColis = exp.colis?.length ?? 0;

  return (
    <Link
      to={expeditionDetailPath(exp.id)}
      className="group flex items-stretch gap-3 rounded-2xl bg-white p-4 shadow-card transition active:scale-[0.99]"
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-xl bg-primary-50 text-primary-600">
        <Package size={19} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-surface-900">
            {exp.reference || 'Demande'}
          </p>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statut.className}`}>
            {statut.label}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-sm text-surface-700">
          <span className="truncate">{villeDepart(exp)}</span>
          <ArrowRight size={13} className="shrink-0 text-surface-300" />
          <span className="truncate">{villeDestination(exp)}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-surface-400">
          <span>{formatDate(exp.created_at)}</span>
          <span className="text-surface-300">•</span>
          <span className="font-semibold text-surface-600">{formatPrice(exp.montant_expedition)}</span>
          <span className="text-surface-300">•</span>
          <span>{getTypeLabel(exp.type_expedition)}</span>
          {nbColis > 0 && (
            <>
              <span className="text-surface-300">•</span>
              <span>{nbColis} colis</span>
            </>
          )}
        </div>
      </div>

      <ChevronRight size={18} className="shrink-0 self-center text-surface-300 transition group-hover:text-surface-500" />
    </Link>
  );
}

export default function HistoryPage() {
  const dispatch = useDispatch();
  const { items, stats, status, error } = useSelector((state) => state.expeditions);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchExpeditions());
      dispatch(fetchExpeditionStats());
    }
  }, [dispatch, isAuthenticated]);

  const counts = useMemo(() => {
    const map = {};
    for (const f of STATUS_FILTERS) map[f.key] = items.filter((e) => f.match(e.statut_expedition)).length;
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const f = STATUS_FILTERS.find((x) => x.key === filter) || STATUS_FILTERS[0];
    return items.filter((e) => f.match(e.statut_expedition));
  }, [items, filter]);

  const refresh = () => {
    dispatch(fetchExpeditions());
    dispatch(fetchExpeditionStats());
  };

  return (
    <div className="min-h-dvh bg-surface-50">
      <TopBar
        title="Mes colis"
        right={
          <div className="flex items-center gap-1">
            {isAuthenticated && (
              <button
                type="button"
                onClick={refresh}
                className="rounded-full p-2 text-surface-500 hover:bg-surface-100"
                aria-label="Rafraîchir"
              >
                <RefreshCw size={16} className={status === 'loading' ? 'animate-spin' : ''} />
              </button>
            )}
            <Link
              to={ROUTES.EXPEDITION_NEW}
              className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Plus size={15} /> Envoyer
            </Link>
          </div>
        }
      />

      <div className="page-container space-y-4 py-4">
        {!isAuthenticated && (
          <EmptyState
            icon={Package}
            title="Connectez-vous pour voir vos colis"
            description="Votre historique apparaît ici dès votre première expédition validée."
            action={
              <button
                type="button"
                className="btn-primary"
                onClick={() => dispatch(openAuthSheet({ mode: 'login', reason: 'default' }))}
              >
                Se connecter
              </button>
            }
          />
        )}

        {isAuthenticated && (
          <>
            <StatCards stats={stats} />

            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filter === f.key
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-white text-surface-500 shadow-card'
                  }`}
                >
                  {f.label}
                  {counts[f.key] > 0 && (
                    <span className={filter === f.key ? 'text-white/70' : 'text-surface-300'}>
                      {' '}
                      {counts[f.key]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {status === 'loading' && items.length === 0 && (
              <LoadingSpinner label="Chargement de vos colis..." />
            )}

            {status === 'error' && (
              <EmptyState
                icon={Package}
                title="Chargement impossible"
                description={error || 'Réessayez dans un instant.'}
                action={
                  <button type="button" className="btn-primary" onClick={refresh}>
                    Réessayer
                  </button>
                }
              />
            )}

            {status !== 'loading' && status !== 'error' && filtered.length === 0 && (
              <EmptyState
                icon={Package}
                title={
                  items.length === 0
                    ? 'Aucune expédition pour le moment'
                    : 'Rien dans ce filtre'
                }
                description={
                  items.length === 0
                    ? "Vos demandes d'expédition s'afficheront ici."
                    : 'Changez de filtre pour voir vos autres demandes.'
                }
                action={
                  items.length === 0 ? (
                    <Link to={ROUTES.EXPEDITION_NEW} className="btn-primary">
                      Envoyer un colis
                    </Link>
                  ) : null
                }
              />
            )}

            {filtered.length > 0 && (
              <div className="space-y-2.5">
                {filtered.map((exp) => (
                  <ExpeditionCard key={exp.id} exp={exp} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
