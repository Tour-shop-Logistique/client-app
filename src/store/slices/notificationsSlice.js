import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import notificationService from '../../services/notificationService';
import { logout, sessionExpired } from './authSlice';
import { loadJson, saveJson } from '../persist';
import {
  ROUTES, expeditionDetailPath, orderPath, salePath,
} from '../../routes';

// Deux sources reunies dans l'ecran Notifications :
//  - server : historique persiste (GET /client/notifications), partage entre
//             appareils et marquable lu cote API. Route demandee au backend
//             (DEMANDE_BACKEND_APP_CLIENT_COMPLETE.md F1) : tant qu'elle n'existe
//             pas (404/405), `server.available` passe a false et rien n'est affiche.
//  - items  : fil local alimente par le WebSocket et les push recus app ouverte,
//             conserve sur l'appareil (50 derniers) et vide a la deconnexion.

export const ACTIVITY_KEY = 'client_activite';
const MAX_ITEMS = 50;
const DUPLICATE_MS = 30 * 1000; // meme evenement relaye par le WebSocket ET le push

// --- Types de notification -> forme commune { kind, titre, message, link } ----

const KIND_RULES = [
  [/livr[ée]e?(?![a-z])|colis_livre|delivered/, 'parcel_delivered'],
  [/frais.?annexe/, 'parcel_fees'],
  [/refus|rejet|demande_refusee/, 'parcel_refused'],
  [/parrain|bonus/, 'referral'],
  [/abonnement.*(bloqu|suspendu)|bloqu/, 'subscription_blocked'],
  [/abonnement|echeance|échéance/, 'subscription'],
  [/annul|expir|non re[cç]u/, 'order_alert'],
  [/commande|marketplace|vente|achat/, 'order'],
  [/paiement|payee|pay[ée]/, 'parcel_payment'],
  [/tarif/, 'parcel_price'],
  [/accept/, 'parcel_accepted'],
  [/colis|exp[ée]dition|livreur|mission|enl[eè]vement/, 'parcel_step'],
];

export const kindFromText = (text) => {
  const s = String(text || '').toLowerCase();
  return KIND_RULES.find(([re]) => re.test(s))?.[1] || 'info';
};

const linkOf = (cible, kind) => {
  const type = String(cible?.type || '').toLowerCase();
  if (cible?.id && type.includes('expedition')) return expeditionDetailPath(cible.id);
  if (cible?.id && type.includes('commande')) return orderPath(cible.id);
  if (cible?.id && type.includes('mission')) return expeditionDetailPath(cible.id);
  if (type.includes('parrainage') || kind === 'referral') return ROUTES.PROFILE_REFERRAL;
  if (type.includes('echeance') || type.includes('abonnement') || kind.startsWith('subscription')) return ROUTES.MARKETPLACE_SUBSCRIPTION;
  return null;
};

export const mapServerNotification = (n) => {
  const data = n?.data || {};
  const signature = `${data.type || ''} ${n?.type || ''} ${data.titre || data.title || ''}`.replace(/[\\]/g, ' ');
  let kind = kindFromText(signature);
  // Repli sur le type de cible quand le texte ne suffit pas.
  if (kind === 'info') {
    const type = String(data.cible?.type || '').toLowerCase();
    if (type.includes('expedition') || type.includes('mission')) kind = 'parcel_step';
    else if (type.includes('commande')) kind = 'order';
  }
  return {
    id: `srv-${n.id}`,
    serverId: n.id,
    server: true,
    kind,
    titre: data.titre || data.title || 'Notification',
    message: data.message || data.body || data.motif || '',
    link: data.url || linkOf(data.cible, kind),
    targetId: data.cible?.id ?? null,
    date: n.created_at,
    lue: Boolean(n.read_at),
  };
};

// Lien d'une commande marketplace selon le role du client dans la commande.
export const marketplaceLink = (id, asSeller) => (id ? (asSeller ? salePath(id) : orderPath(id)) : null);

const message = (err, fallback) => err.response?.data?.message || fallback;
// Routes pas encore deployees cote backend : pas une erreur a montrer.
const isMissingRoute = (err) => [404, 405, 501].includes(err.response?.status);

export const fetchServerNotifications = createAsyncThunk(
  'notifications/fetchServer',
  async ({ page = 1 } = {}, { rejectWithValue }) => {
    try {
      const p = await notificationService.fetchPage(page);
      const list = Array.isArray(p) ? p : p?.data ?? [];
      const items = list.map(mapServerNotification);
      return {
        items, page: p?.current_page ?? page, lastPage: p?.last_page ?? 1, available: true,
      };
    } catch (err) {
      if (isMissingRoute(err)) return { items: [], page: 1, lastPage: 1, available: false };
      return rejectWithValue(message(err, 'Impossible de charger vos notifications.'));
    }
  }
);

export const markServerNotificationRead = createAsyncThunk(
  'notifications/markServerRead',
  async (serverId, { rejectWithValue }) => {
    try {
      await notificationService.markRead(serverId);
      return serverId;
    } catch (err) {
      if (isMissingRoute(err)) return serverId;
      return rejectWithValue(message(err, 'Action impossible.'));
    }
  }
);

export const markAllServerNotificationsRead = createAsyncThunk(
  'notifications/markAllServerRead',
  async (_, { rejectWithValue }) => {
    try {
      await notificationService.markAllRead();
      return true;
    } catch (err) {
      if (isMissingRoute(err)) return true;
      return rejectWithValue(message(err, 'Action impossible.'));
    }
  }
);

const emptyServer = () => ({
  items: [], page: 1, lastPage: 1, status: 'idle', error: null, loaded: false, available: true,
});

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: loadJson(ACTIVITY_KEY, []),
    server: emptyServer(),
  },
  reducers: {
    // payload : { kind, titre, message?, link?, targetId? }
    pushActivity: {
      reducer(state, action) {
        const item = action.payload;
        const at = Date.parse(item.date);
        // Meme titre a quelques secondes pres (WebSocket + push) : une seule ligne.
        const duplicate = state.items.some((n) => n.titre === item.titre
          && Math.abs(Date.parse(n.date) - at) < DUPLICATE_MS);
        if (duplicate) return;
        state.items = [item, ...state.items].slice(0, MAX_ITEMS);
        saveJson(ACTIVITY_KEY, state.items);
      },
      prepare(item) {
        return {
          payload: {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            date: new Date().toISOString(),
            lue: false,
            ...item,
          },
        };
      },
    },
    markAllRead(state) {
      state.items = state.items.map((n) => ({ ...n, lue: true }));
      saveJson(ACTIVITY_KEY, state.items);
    },
    markRead(state, action) {
      const item = state.items.find((n) => n.id === action.payload);
      if (item) item.lue = true;
      saveJson(ACTIVITY_KEY, state.items);
    },
    clearActivity(state) {
      state.items = [];
      saveJson(ACTIVITY_KEY, state.items);
    },
  },
  extraReducers: (builder) => {
    const reset = (state) => {
      state.items = [];
      state.server = emptyServer();
      saveJson(ACTIVITY_KEY, []);
    };
    builder
      // Le fil appartient au compte : vide a la deconnexion / session expiree.
      .addCase(logout.fulfilled, reset)
      .addCase(sessionExpired, reset)
      .addCase(fetchServerNotifications.pending, (state) => { state.server.status = 'loading'; state.server.error = null; })
      .addCase(fetchServerNotifications.fulfilled, (state, action) => {
        const {
          items, page, lastPage, available,
        } = action.payload;
        state.server = {
          items: page > 1 ? [...state.server.items, ...items.filter((n) => !state.server.items.some((o) => o.id === n.id))] : items,
          page, lastPage, status: 'idle', error: null, loaded: true, available,
        };
      })
      .addCase(fetchServerNotifications.rejected, (state, action) => {
        state.server.status = 'error';
        state.server.error = action.payload;
        state.server.loaded = true;
      })
      .addCase(markServerNotificationRead.pending, (state, action) => {
        const item = state.server.items.find((n) => n.serverId === action.meta.arg);
        if (item) item.lue = true;
      })
      .addCase(markAllServerNotificationsRead.pending, (state) => {
        state.server.items = state.server.items.map((n) => ({ ...n, lue: true }));
      });
  },
});

export const {
  pushActivity, markAllRead, markRead, clearActivity,
} = notificationsSlice.actions;

// Fil unifie, sans doublon : un evenement local qui a aussi produit une
// notification serveur (meme cible, a 3 min pres) n'est affiche qu'une fois.
const DEDUPE_MS = 3 * 60 * 1000;
export const selectActivityFeed = createSelector(
  [(state) => state.notifications.items, (state) => state.notifications.server.items],
  (items, serverItems) => {
    const local = items.filter((a) => !a.targetId || !serverItems.some((s) => (
      String(s.targetId) === String(a.targetId)
      && Math.abs(Date.parse(s.date) - Date.parse(a.date)) < DEDUPE_MS
    )));
    return [...serverItems, ...local].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }
);

export const selectUnreadCount = (state) => selectActivityFeed(state).filter((n) => !n.lue).length;
export default notificationsSlice.reducer;
