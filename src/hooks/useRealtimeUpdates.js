import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useWebSocket } from './useWebSocket';
import { orderPath, salePath, expeditionDetailPath } from '../routes';
import { getStatutMeta } from '../utils/expeditionStatus';

// Couche pratique au-dessus de useWebSocket (meme idee que dans
// l'app agence-partenaire) : branche l'ID du client connecte depuis le
// store Redux et expose des hooks prets a l'emploi pour rafraichir les
// donnees a chaque evenement temps reel.
//
// Types d'evenements emis :
//   expedition.* | colis.status_changed | delivery_offer.received | mission.published
//   mission.step (enlevement_demarre, colis_recupere, colis_depose_agence_livreur,
//   livraison_demarree, colis_livre) — canal client.{id}, REPONSE_DEMANDE_BACKEND_APP_CLIENT_COMPLETE.md C1
//   marketplace.<Model>.<action> (ex. marketplace.CommandeMarketplace.payee) —
//   `meta.model` / `meta.action` portent le detail (WEBSOCKETS.md).

/**
 * Ecoute tous les evenements temps reel du client et declenche `onUpdate`
 * a chaque changement.
 *
 * @param {Function} onUpdate - Appele avec (data, meta, eventType).
 * @param {Object} options
 * @param {Array<string>} options.only - Restreindre a certains types ('expeditions', 'colis', 'offres', 'missions', 'marketplace').
 * @param {boolean} options.enabled - Activer/desactiver (defaut: true).
 */
export function useRealtimeUpdates(onUpdate, options = {}) {
  const { only = null, enabled = true } = options;
  const user = useSelector((state) => state.auth.user);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  const shouldListen = useCallback(
    (type) => !only || only.length === 0 || only.includes(type),
    [only]
  );

  const emit = useCallback(
    (data, meta, eventType) => {
      if (import.meta.env.DEV) console.log(`🔄 [RealtimeUpdates] ${eventType}`, meta);
      if (typeof onUpdate === 'function') onUpdate(data, meta, eventType);
    },
    [onUpdate]
  );

  const handlers = {
    onExpeditionCreated: shouldListen('expeditions')
      ? (d, m) => emit(d, m, 'expedition.created')
      : undefined,
    onExpeditionStatusChanged: shouldListen('expeditions')
      ? (d, m) => emit(d, m, 'expedition.status_changed')
      : undefined,
    onExpeditionPaymentConfirmed: shouldListen('expeditions')
      ? (d, m) => emit(d, m, 'expedition.payment_confirmed')
      : undefined,
    onExpeditionDelivered: shouldListen('expeditions')
      ? (d, m) => emit(d, m, 'expedition.delivered')
      : undefined,
    onColisStatusChanged: shouldListen('colis')
      ? (d, m) => emit(d, m, 'colis.status_changed')
      : undefined,
    onDeliveryOfferReceived: shouldListen('offres')
      ? (d, m) => emit(d, m, 'delivery_offer.received')
      : undefined,
    onMissionPublished: shouldListen('offres')
      ? (d, m) => emit(d, m, 'mission.published')
      : undefined,
    onMissionStep: shouldListen('missions')
      ? (d, m) => emit(d, m, 'mission.step')
      : undefined,
    onMarketplaceEvent: shouldListen('marketplace')
      ? (model, action, d, m) => emit(d, m, `marketplace.${model}.${action}`)
      : undefined,
  };

  useWebSocket(user?.id, handlers, enabled && isAuthenticated && !!user?.id);
}

// Expedition(s) concernee(s) par un evenement : `ids` pour les evenements
// Expedition, `data[].expedition_id` pour Mission/etape et les colis.
export const expeditionIdsOf = (data, meta) => {
  const fromData = (data || []).map((d) => d?.expedition_id).filter(Boolean);
  const own = meta?.model === 'Expedition' ? [...(meta.ids || []), ...(data || []).map((d) => d?.id)] : [];
  return [...fromData, ...own].filter(Boolean).map(String);
};

const EXPEDITION_TYPES = ['expeditions', 'colis', 'offres', 'missions'];

/**
 * Suivi temps reel d'une seule expedition (page de detail / suivi).
 * Ne declenche `onUpdate` que si l'evenement concerne `expeditionId` — ou s'il
 * ne permet pas de le savoir (offres : mieux vaut un rechargement de trop).
 */
export function useRealtimeExpedition(expeditionId, onUpdate, enabled = true) {
  const handle = useCallback(
    (data, meta, eventType) => {
      const ids = expeditionIdsOf(data, meta);
      const refs = meta?.references || [];
      if (!expeditionId || ids.length === 0 || ids.includes(String(expeditionId)) || refs.includes(expeditionId)) {
        onUpdate?.(data, meta, eventType);
      }
    },
    [expeditionId, onUpdate]
  );

  useRealtimeUpdates(handle, { only: EXPEDITION_TYPES, enabled });
}

// Libelles des etapes du dernier kilometre (Mission/etape).
const MISSION_STEP_TOASTS = {
  enlevement_demarre: { title: 'Le livreur est en route pour récupérer votre colis', tone: 'info' },
  colis_recupere: { title: 'Le livreur a récupéré votre colis', tone: 'success' },
  colis_depose_agence_livreur: { title: 'Votre colis a été déposé à l’agence de départ', tone: 'success' },
  livraison_demarree: { title: 'Votre colis est en cours de livraison 🚚', tone: 'info' },
  colis_livre: { title: 'Votre colis a été livré 🎉', tone: 'success' },
};

// Commande concernee par un evenement marketplace : id de la commande, ou
// `commande_marketplace_id` pour une livraison / offre de livraison.
export const marketplaceCommandeIds = (data, meta) => {
  if (meta?.model === 'CommandeMarketplace') return (meta.ids?.length ? meta.ids : data.map((d) => d?.id)).map(String);
  return data
    .map((d) => d?.commande_marketplace_id ?? d?.commande?.id ?? d?.livraison_marketplace?.commande_marketplace_id)
    .filter(Boolean)
    .map(String);
};

/**
 * Evenements marketplace (commandes, livraisons, offres). Avec `commandeId`, ne
 * declenche `onUpdate` que pour cette commande (ou si l'evenement ne permet pas
 * de la determiner : mieux vaut un rechargement de trop qu'un ecran perime).
 */
export function useRealtimeMarketplace(commandeId, onUpdate, enabled = true) {
  const handle = useCallback(
    (data, meta, eventType) => {
      if (commandeId) {
        const ids = marketplaceCommandeIds(data, meta);
        if (ids.length && !ids.includes(String(commandeId))) return;
      }
      onUpdate?.(data, meta, eventType);
    },
    [commandeId, onUpdate]
  );

  useRealtimeUpdates(handle, { only: ['marketplace'], enabled });
}

// Role du client connecte dans la commande, quand le payload le permet.
const roleIn = (item, userId) => {
  const vendeur = item?.vendeur_id ?? item?.commande?.vendeur_id;
  const acheteur = item?.acheteur_id ?? item?.commande?.acheteur_id;
  if (userId && vendeur && String(vendeur) === String(userId)) return 'vendeur';
  if (userId && acheteur && String(acheteur) === String(userId)) return 'acheteur';
  return null;
};

/**
 * Version avec notifications toast automatiques (sonner).
 */
export function useRealtimeWithNotifications(onUpdate, options = {}) {
  const navigate = useNavigate();
  const userId = useSelector((state) => state.auth.user?.id);

  const handle = useCallback(
    (data, meta, eventType) => {
      const item = data?.[0];
      const role = roleIn(item, userId);
      const commandeId = marketplaceCommandeIds(data, meta)[0];
      const open = (path) => (commandeId ? { label: 'Voir', onClick: () => navigate(path(commandeId)) } : undefined);

      const expId = expeditionIdsOf(data, meta)[0];
      const openExp = expId ? { label: 'Voir', onClick: () => navigate(expeditionDetailPath(expId)) } : undefined;
      const ref = item?.reference || meta?.references?.[0];

      switch (eventType) {
        case 'expedition.status_changed': {
          const statut = item?.statut_expedition;
          if (statut === 'refused') toast.warning(ref ? `Demande ${ref} refusée par l’agence` : 'Demande refusée par l’agence', { action: openExp, duration: 10000 });
          else if (statut === 'accepted') toast.success(ref ? `Demande ${ref} acceptée par l’agence` : 'Demande acceptée par l’agence', { action: openExp });
          else {
            toast.info(statut ? getStatutMeta(statut).label : 'Le statut de votre colis a été mis à jour', {
              description: ref ? `Expédition ${ref}` : undefined,
              action: openExp,
            });
          }
          break;
        }
        case 'expedition.payment_confirmed':
          toast.success(item?.statut_paiement === 'paye' ? 'Paiement de votre expédition enregistré' : 'Paiement mis à jour', {
            description: ref ? `Expédition ${ref}` : undefined,
            action: openExp,
          });
          break;
        case 'mission.step': {
          const step = MISSION_STEP_TOASTS[item?.etape];
          if (step) toast[step.tone](step.title, { action: openExp, duration: item?.etape === 'colis_livre' ? 10000 : undefined });
          break;
        }
        case 'expedition.delivered':
          toast.success('Votre colis a ete livre 🎉');
          break;
        case 'delivery_offer.received':
          toast.info('Un livreur a fait une offre pour votre colis');
          break;
        case 'colis.status_changed':
          toast.info('Mise a jour du suivi de votre colis');
          break;
        case 'mission.published':
          toast.info('Votre demande est diffusée aux livreurs', { description: 'Les offres de prix vont arriver.' });
          break;

        // --- Marketplace : commandes ---------------------------------------
        case 'marketplace.CommandeMarketplace.paiement_declare':
          if (role !== 'acheteur') {
            toast.info('Paiement déclaré par un acheteur', { description: 'Vérifiez la réception puis confirmez.', action: open(salePath) });
          }
          break;
        case 'marketplace.CommandeMarketplace.payee':
          if (role !== 'vendeur') {
            toast.success('Paiement confirmé par le vendeur', { description: 'Il organise maintenant la livraison.', action: open(orderPath) });
          }
          break;
        case 'marketplace.CommandeMarketplace.paiement_infirme':
          if (role !== 'vendeur') {
            toast.warning('Paiement non reçu par le vendeur', {
              description: 'Vous devez re-déclarer un paiement.',
              duration: 10000,
              action: open(orderPath),
            });
          }
          break;
        case 'marketplace.CommandeMarketplace.annulee':
          toast.warning(role === 'vendeur' ? 'Une commande a été annulée' : 'Votre commande a été annulée', {
            description: item?.motif_annulation || undefined,
            action: open(role === 'vendeur' ? salePath : orderPath),
          });
          break;
        case 'marketplace.CommandeMarketplace.livree':
          toast.success(role === 'vendeur' ? 'Vente livrée 🎉' : 'Commande livrée 🎉', {
            action: open(role === 'vendeur' ? salePath : orderPath),
          });
          break;

        // --- Marketplace : livraisons ---------------------------------------
        case 'marketplace.LivraisonMarketplace.assignee':
          if (role === 'acheteur') {
            toast.success('Un livreur prend en charge votre commande', { description: 'Gardez votre code de remise.', action: open(orderPath) });
          } else {
            toast.success('Un livreur a accepté la livraison', { action: open(salePath) });
          }
          break;
        case 'marketplace.LivraisonMarketplace.refusee':
        case 'marketplace.LivraisonMarketplace.expiree':
          toast.warning(meta.action === 'expiree' ? 'Le livreur n’a pas répondu à temps' : 'Le livreur a refusé la livraison', {
            description: 'Choisissez un autre mode de livraison.',
            duration: 10000,
            action: open(salePath),
          });
          break;
        case 'marketplace.LivraisonMarketplace.demarree':
          if (role === 'vendeur') toast.info('Le livreur a récupéré l’article', { action: open(salePath) });
          else toast.info('Votre commande est en route 🚚', { action: open(orderPath) });
          break;
        case 'marketplace.LivraisonMarketplaceOffre.proposee':
          toast.info('Nouvelle offre d’un livreur', { description: 'Comparez les offres de livraison.', action: open(salePath) });
          break;
        default:
          break;
      }
      onUpdate?.(data, meta, eventType);
    },
    [onUpdate, navigate, userId]
  );

  return useRealtimeUpdates(handle, options);
}

export default useRealtimeUpdates;
