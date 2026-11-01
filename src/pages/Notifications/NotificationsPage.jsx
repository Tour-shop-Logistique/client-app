import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell, BellRing, Package, PackageCheck, Truck, CircleCheckBig, CircleX, CheckCheck, Trash2, Wallet, Receipt,
  ShoppingBag, TriangleAlert, Gift, CalendarClock, Lock, RefreshCw, Building2, X,
} from 'lucide-react';
import TopBar from '../../components/common/TopBar';
import EmptyState from '../../components/common/EmptyState';
import { EmptyParcelArt } from '../../components/illustrations';
import usePushSubscription from '../../hooks/usePushSubscription';
import {
  markAllRead, markRead, clearActivity, fetchServerNotifications, markServerNotificationRead,
  markAllServerNotificationsRead, deleteServerNotification, removeActivity, selectActivityFeed,
} from '../../store/slices/notificationsSlice';
import { openAuthSheet } from '../../store/slices/uiSlice';
import { formatDateTime, formatRelativeShort } from '../../utils/format';
import { ROUTES } from '../../routes';

// Notifications du client : historique serveur (GET /client/notifications, quand
// le backend le fournit) + evenements recus app ouverte (WebSocket / push),
// conserves sur l'appareil.
const KIND = {
  parcel_delivered: { icon: PackageCheck, className: 'bg-emerald-100 text-emerald-700' },
  parcel_step: { icon: Truck, className: 'bg-primary-100 text-primary-600' },
  parcel_accepted: { icon: CircleCheckBig, className: 'bg-emerald-100 text-emerald-700' },
  parcel_refused: { icon: CircleX, className: 'bg-red-100 text-red-600' },
  parcel_payment: { icon: Wallet, className: 'bg-teal-100 text-teal-600' },
  parcel_price: { icon: Receipt, className: 'bg-amber-100 text-amber-700' },
  parcel_received: { icon: Building2, className: 'bg-teal-100 text-teal-600' },
  parcel_fees: { icon: Receipt, className: 'bg-amber-100 text-amber-700' },
  order: { icon: ShoppingBag, className: 'bg-shop-100 text-shop-700' },
  order_alert: { icon: TriangleAlert, className: 'bg-amber-100 text-amber-700' },
  referral: { icon: Gift, className: 'bg-violet-100 text-violet-700' },
  subscription: { icon: CalendarClock, className: 'bg-amber-100 text-amber-700' },
  subscription_blocked: { icon: Lock, className: 'bg-red-100 text-red-600' },
  info: { icon: Bell, className: 'bg-surface-100 text-surface-500' },
};

const GROUP_OF = (kind) => (kind.startsWith('parcel_') ? 'colis' : kind.startsWith('order') ? 'marketplace' : 'compte');

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'colis', label: 'Colis' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'compte', label: 'Compte' },
];

// "Aujourd'hui" / "Hier" / "12 oct." pour regrouper la liste par jour.
const dayKey = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'x' : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Aujourd’hui';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
};

function NotificationRow({ item, onOpen, onRemove }) {
  const kind = KIND[item.kind] || KIND.info;
  return (
    <li className={`flex items-start ${item.lue ? '' : 'bg-primary-50/50'}`}>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 items-start gap-3 p-4 pr-2 text-left transition active:bg-surface-50"
      >
        <span className={`icon-tile h-10 w-10 shrink-0 rounded-[13px] ${kind.className}`}><kind.icon size={18} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className={`text-sm text-surface-900 ${item.lue ? 'font-medium' : 'font-semibold'}`}>{item.titre}</span>
            <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
              {!item.lue && <span className="h-2 w-2 rounded-full bg-shop-400 ring-2 ring-shop-100" aria-hidden="true" />}
              <time dateTime={item.date} title={formatDateTime(item.date)} className="text-caption text-surface-500">
                {formatRelativeShort(item.date)}
              </time>
            </span>
          </span>
          {item.message && <span className="mt-0.5 block text-xs leading-snug text-surface-500">{item.message}</span>}
          {!item.lue && <span className="sr-only">Non lue</span>}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onRemove(item)}
        aria-label="Supprimer cette notification"
        className="m-1.5 mt-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-surface-300 transition hover:bg-surface-100 hover:text-surface-500 active:scale-90"
      >
        <X size={16} />
      </button>
    </li>
  );
}

export default function NotificationsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const items = useSelector(selectActivityFeed);
  const server = useSelector((state) => state.notifications.server);
  const hasLocal = useSelector((state) => state.notifications.items.length > 0);
  const push = usePushSubscription();
  const [filter, setFilter] = useState('all');
  const hasUnread = items.some((n) => !n.lue);

  useEffect(() => {
    if (isAuthenticated) dispatch(fetchServerNotifications());
  }, [dispatch, isAuthenticated]);

  // Les elements locaux consultes passent "lus" en quittant l'ecran.
  useEffect(() => () => { dispatch(markAllRead()); }, [dispatch]);

  const { groups, options } = useMemo(() => {
    const match = (f, n) => f.key === 'all' || GROUP_OF(n.kind) === f.key;
    const active = FILTERS.find((f) => f.key === filter) || FILTERS[0];
    const visible = items.filter((n) => match(active, n));
    const byDay = [];
    visible.forEach((n) => {
      const key = dayKey(n.date);
      const last = byDay[byDay.length - 1];
      if (last && last.key === key) last.items.push(n);
      else byDay.push({ key, label: dayLabel(n.date), items: [n] });
    });
    return {
      groups: byDay,
      // Compteur = elements non lus de chaque filtre.
      options: FILTERS.map((f) => ({ ...f, count: items.filter((n) => !n.lue && match(f, n)).length })),
    };
  }, [items, filter]);

  const readAll = () => {
    dispatch(markAllRead());
    if (server.items.some((n) => !n.lue)) dispatch(markAllServerNotificationsRead());
  };

  const open = (n) => {
    if (n.server) {
      if (!n.lue) dispatch(markServerNotificationRead(n.serverId));
    } else {
      dispatch(markRead(n.id));
    }
    if (n.link) navigate(n.link);
  };

  const remove = (n) => {
    if (n.server) dispatch(deleteServerNotification(n.serverId));
    else dispatch(removeActivity(n.id));
  };

  const loadingFirst = isAuthenticated && !server.loaded && server.status === 'loading';
  const loadingMore = server.status === 'loading';
  const actionBtn = 'flex h-11 w-11 items-center justify-center rounded-[14px] bg-white text-surface-700 shadow-card transition active:scale-90';

  return (
    <div>
      <TopBar
        title="Notifications"
        back
        right={isAuthenticated ? (
          <div className="flex items-center gap-2">
            {hasUnread && (
              <button type="button" className={actionBtn} aria-label="Tout marquer comme lu" onClick={readAll}>
                <CheckCheck size={19} />
              </button>
            )}
            {hasLocal && (
              <button type="button" className={actionBtn} aria-label="Effacer les notifications de cet appareil" onClick={() => dispatch(clearActivity())}>
                <Trash2 size={18} />
              </button>
            )}
            {server.available && (
              <button type="button" className={actionBtn} aria-label="Actualiser" onClick={() => dispatch(fetchServerNotifications())}>
                <RefreshCw size={18} className={loadingMore ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        ) : null}
      />

      <div className="page-container space-y-3 py-4">
        {!isAuthenticated ? (
          <EmptyState
            illustration={<EmptyParcelArt />}
            title="Connectez-vous pour voir vos notifications"
            description="Suivi de vos colis, paiements, commandes et parrainage apparaissent ici."
            action={(
              <button type="button" className="btn-primary" onClick={() => dispatch(openAuthSheet({ mode: 'login', reason: 'default' }))}>
                Se connecter
              </button>
            )}
          />
        ) : (
          <>
            {push.supported && push.ready && !push.enabled && push.permission !== 'denied' && (
              <Link
                to={ROUTES.PROFILE}
                className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-card transition active:scale-[0.99]"
              >
                <span className="icon-tile h-10 w-10 shrink-0 rounded-xl bg-amber-100 text-amber-700"><BellRing size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-surface-900">Activer les notifications</span>
                  <span className="block text-xs text-surface-500">Soyez alerté même quand l’application est fermée.</span>
                </span>
              </Link>
            )}

            {server.status === 'error' && (
              <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                {server.error || 'Historique indisponible pour le moment.'}{' '}
                <button type="button" className="font-semibold underline" onClick={() => dispatch(fetchServerNotifications())}>Réessayer</button>
              </p>
            )}

            {items.length === 0 ? (
              <EmptyState
                illustration={<EmptyParcelArt />}
                title={loadingFirst ? 'Chargement…' : 'Aucune notification'}
                description="Le suivi de vos colis, vos paiements, vos commandes et votre parrainage apparaîtront ici."
              />
            ) : (
              <>
                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                  {options.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      aria-pressed={filter === f.key}
                      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition active:scale-95 ${
                        filter === f.key
                          ? 'bg-navy-800 text-white shadow-[0_8px_16px_-10px_rgba(43,38,80,0.8)]'
                          : 'bg-white text-surface-600 shadow-card'
                      }`}
                    >
                      {f.label}
                      {f.count > 0 && (
                        <span className={`rounded-full px-1.5 py-px text-[11px] ${filter === f.key ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-600'}`}>
                          {f.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {groups.length === 0 ? (
                  <EmptyState icon={Bell} title="Rien dans ce filtre" description="Les notifications correspondantes apparaîtront ici." />
                ) : (
                  groups.map((g) => (
                    <section key={g.key} className="space-y-2">
                      <h2 className="px-1 text-caption font-semibold uppercase tracking-wide text-surface-500">{g.label}</h2>
                      <ul className="card divide-y divide-surface-100 overflow-hidden">
                        {g.items.map((n) => <NotificationRow key={n.id} item={n} onOpen={open} onRemove={remove} />)}
                      </ul>
                    </section>
                  ))
                )}

                {server.page < server.lastPage && (
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    aria-busy={loadingMore}
                    disabled={loadingMore}
                    onClick={() => dispatch(fetchServerNotifications({ page: server.page + 1 }))}
                  >
                    {loadingMore ? 'Chargement…' : 'Notifications plus anciennes'}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
