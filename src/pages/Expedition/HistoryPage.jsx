import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Package, Plus, RefreshCw, ChevronRight, ArrowRight, Clock, Truck, CheckCircle2 } from 'lucide-react';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ExpeditionStatusBadge from '../../components/expedition/ExpeditionStatusBadge';
import { BoxArt, EmptyParcelArt } from '../../components/illustrations';
import { fetchExpeditions, fetchExpeditionStats } from '../../store/slices/expeditionSlice';
import { openAuthSheet } from '../../store/slices/uiSlice';
import { formatDate, formatPrice } from '../../utils/format';
import {
  EN_COURS_STATUSES, getProgress, getTypeLabel, STATUS_FILTERS, villeDepart, villeDestination,
} from '../../utils/expeditionStatus';
import { ROUTES, expeditionDetailPath } from '../../routes';

function StatCards({ stats }) {
  if (!stats) return null;
  const cells = [
    { label: 'Total', value: stats.total ?? 0, icon: Package, color: 'bg-primary-100 text-primary-600' },
    { label: 'En attente', value: stats.en_attente ?? 0, icon: Clock, color: 'bg-amber-100 text-amber-700' },
    { label: 'En cours', value: stats.en_cours ?? 0, icon: Truck, color: 'bg-teal-100 text-teal-600' },
    { label: 'Terminées', value: stats.termined ?? 0, icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
  ];
  return (
    <div className="grid grid-cols-4 gap-1 rounded-[1.4rem] bg-white px-2 py-3.5 shadow-[0_16px_36px_-14px_rgba(15,23,42,0.28)]">
      {cells.map((c) => (
        <div key={c.label} className="flex flex-col items-center gap-1 text-center">
          <span className={`icon-tile mb-0.5 h-9 w-9 rounded-xl ${c.color}`}>
            <c.icon size={17} />
          </span>
          <p className="font-heading text-lg font-bold leading-tight text-surface-900">{c.value}</p>
          <p className="text-[11px] font-medium leading-tight text-surface-500">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

function ExpeditionCard({ exp }) {
  const nbColis = exp.colis?.length ?? 0;

  return (
    <Link
      to={expeditionDetailPath(exp.id)}
      className="group flex items-stretch gap-3 rounded-2xl bg-white p-4 shadow-card transition active:scale-[0.99]"
    >
      <span className="icon-tile h-11 w-11 self-start rounded-[14px] bg-primary-100 text-primary-600">
        <Package size={20} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-surface-900">
            {exp.reference || 'Demande'}
          </p>
          <ExpeditionStatusBadge statut={exp.statut_expedition} />
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-surface-700">
          <span className="truncate">{villeDepart(exp)}</span>
          <ArrowRight size={13} className="shrink-0 text-primary-400" />
          <span className="truncate">{villeDestination(exp)}</span>
        </div>

        {EN_COURS_STATUSES.includes(exp.statut_expedition) && (
          <div className="mt-2.5 h-1.5 rounded-full bg-surface-100" aria-hidden="true">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-primary-600 to-teal-400"
              style={{ width: `${Math.round(Math.max(getProgress(exp).ratio, 0.08) * 100)}%` }}
            />
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-surface-600">
          <span className="rounded-full bg-surface-100 px-2 py-0.5">{formatDate(exp.created_at)}</span>
          <span className="rounded-full bg-surface-100 px-2 py-0.5">{getTypeLabel(exp.type_expedition)}</span>
          {nbColis > 0 && <span className="rounded-full bg-surface-100 px-2 py-0.5">{nbColis} colis</span>}
          <span className="ml-auto font-heading text-sm font-bold text-surface-900">{formatPrice(exp.montant_expedition)}</span>
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
    <div className="min-h-dvh bg-surface-50 safe-top">
      <div className="brand-gradient relative overflow-hidden rounded-b-[2rem] pb-16 pt-5">
        <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/[0.07]" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-shop-400/20" />

        <div className="page-container relative">
          <div className="flex items-center justify-between gap-2">
            <h1 className="font-heading text-lg font-bold text-white">Mes colis</h1>
            <div className="flex items-center gap-2">
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={refresh}
                  className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/15 text-white"
                  aria-label="Rafraîchir"
                >
                  <RefreshCw size={18} className={status === 'loading' ? 'animate-spin' : ''} />
                </button>
              )}
              <Link
                to={ROUTES.EXPEDITION_NEW}
                className="inline-flex h-11 items-center gap-1.5 rounded-[14px] bg-shop-400 px-3.5 text-body font-bold text-shop-950"
              >
                <Plus size={17} strokeWidth={2.6} /> Envoyer
              </Link>
            </div>
          </div>
          <div className="relative mt-4 flex items-end justify-between">
            <p className="w-48 text-body text-white/85">Suivez chacun de vos envois, étape par étape.</p>
            <BoxArt size={76} className="-mb-2 animate-float" />
          </div>
        </div>
      </div>

      <div className="page-container space-y-4 pb-4">
        {!isAuthenticated && (
          <div className="pt-4">
            <EmptyState
              illustration={<EmptyParcelArt />}
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
          </div>
        )}

        {isAuthenticated && (
          <>
            <div className="relative -mt-10">
              <StatCards stats={stats} />
            </div>

            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition active:scale-95 ${
                    filter === f.key
                      ? 'bg-navy-800 text-white shadow-[0_8px_16px_-10px_rgba(43,38,80,0.8)]'
                      : 'bg-white text-surface-600 shadow-card'
                  }`}
                >
                  {f.label}
                  {counts[f.key] > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-px text-[11px] ${
                        filter === f.key ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-600'
                      }`}
                    >
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
                illustration={<EmptyParcelArt />}
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
                      Envoyer mon premier colis
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
