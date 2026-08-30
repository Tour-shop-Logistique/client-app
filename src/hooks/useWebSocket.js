import { useEffect, useRef, useCallback } from 'react';
import { getEcho, disconnectEcho } from '../services/echo';

// Portage du hook WebSocket de l'app agence-partenaire, adapte au client :
//   - canal prive `client.{userId}` (au lieu de `agence.{agenceId}`)
//   - meme evenement generique `.model.updated` avec un payload
//     { model, action, data, ids, references, changes, count, at }
//   - meme registre partage : plusieurs composants peuvent ecouter le meme
//     canal, mais un seul channel.listen() reel est pose par canal, qui
//     redispatche ensuite vers tous les callbacks inscrits.

const channelListeners = new Map(); // channelName -> Set<callback>
const channelRefs = new Map(); // channelName -> instance Echo channel

/**
 * Hook d'abonnement WebSocket pour le client.
 *
 * @param {string|null} userId - ID (uuid) du client connecte a ecouter.
 * @param {Object} handlers - Gestionnaires d'evenements :
 * @param {Function} handlers.onExpeditionCreated - Nouvelle expedition enregistree.
 * @param {Function} handlers.onExpeditionStatusChanged - Changement de statut d'une expedition (suivi colis).
 * @param {Function} handlers.onExpeditionPaymentConfirmed - Paiement confirme.
 * @param {Function} handlers.onExpeditionDelivered - Colis livre.
 * @param {Function} handlers.onDeliveryOfferReceived - Nouvelle offre de livreur recue.
 * @param {Function} handlers.onColisStatusChanged - Changement de statut d'un colis.
 * @param {boolean} enabled - Active/desactive l'ecoute (defaut: true).
 */
export function useWebSocket(userId, handlers = {}, enabled = true) {
  const channelRef = useRef(null);
  const handlersRef = useRef(handlers);

  // Garde la reference des handlers a jour sans re-declencher l'effet.
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Routeur unifie pour tous les evenements `.model.updated`.
  const handleModelUpdate = useCallback((payload) => {
    console.log('📥 [WebSocket] Message recu :', {
      model: payload.model,
      action: payload.action,
      count: payload.count,
      ids: payload.ids,
      references: payload.references,
      at: payload.at,
    });

    const { model, action, data, ids, references, changes, count, at } = payload;
    const meta = { ids, references, changes, count, at };
    const h = handlersRef.current;

    switch (model) {
      case 'Expedition':
        if (action === 'created' && h.onExpeditionCreated) {
          h.onExpeditionCreated(data, meta);
        } else if (action === 'status_changed' && h.onExpeditionStatusChanged) {
          h.onExpeditionStatusChanged(data, meta);
        } else if (action === 'payment_confirmed' && h.onExpeditionPaymentConfirmed) {
          h.onExpeditionPaymentConfirmed(data, meta);
        } else if (action === 'delivered' && h.onExpeditionDelivered) {
          h.onExpeditionDelivered(data, meta);
        } else {
          console.warn(`⚠️ [WebSocket] Action '${action}' non geree pour Expedition ou handler manquant`);
        }
        break;

      case 'Colis':
        if (action === 'status_changed' && h.onColisStatusChanged) {
          h.onColisStatusChanged(data, meta);
        } else {
          console.warn(`⚠️ [WebSocket] Action '${action}' non geree pour Colis ou handler manquant`);
        }
        break;

      case 'DeliveryOffer':
      case 'OffreLivraison':
        if (action === 'created' && h.onDeliveryOfferReceived) {
          h.onDeliveryOfferReceived(data, meta);
        } else {
          console.warn(`⚠️ [WebSocket] Action '${action}' non geree pour ${model} ou handler manquant`);
        }
        break;

      default:
        console.warn(`⚠️ [WebSocket] Modele '${model}' non reconnu, evenement ignore :`, { model, action });
    }
  }, []);

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    const echo = getEcho();
    if (!echo) {
      console.warn('[WebSocket] Impossible de s\'abonner : Echo non initialise');
      return;
    }

    const channelName = `client.${userId}`;

    if (!channelListeners.has(channelName)) {
      channelListeners.set(channelName, new Set());
    }
    channelListeners.get(channelName).add(handleModelUpdate);

    // Un seul channel.listen() reel par canal, meme si plusieurs composants
    // s'abonnent en parallele.
    if (!channelRefs.has(channelName)) {
      console.log(`🔌 [WebSocket] Abonnement au canal : ${channelName}`);
      const channel = echo.private(channelName);
      channelRefs.set(channelName, channel);

      channel.subscribed(() => {
        console.log(`✅ [WebSocket] Abonne au canal : ${channelName}`);
      });

      channel.error((error) => {
        console.error(`❌ [WebSocket] Erreur sur le canal ${channelName} :`, error);
      });

      channel.listen('.model.updated', (payload) => {
        channelListeners.get(channelName)?.forEach((cb) => cb(payload));
      });
    }

    channelRef.current = channelName;

    return () => {
      const listeners = channelListeners.get(channelName);
      if (listeners) {
        listeners.delete(handleModelUpdate);
        if (listeners.size === 0) {
          console.log(`🔌 [WebSocket] Desabonnement du canal : ${channelName}`);
          echo.leave(channelName);
          channelListeners.delete(channelName);
          channelRefs.delete(channelName);
        }
      }
      channelRef.current = null;
    };
  }, [userId, enabled, handleModelUpdate]);

  return { disconnect: disconnectEcho };
}
