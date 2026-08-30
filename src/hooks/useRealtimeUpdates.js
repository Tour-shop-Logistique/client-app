import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { useWebSocket } from './useWebSocket';

// Couche pratique au-dessus de useWebSocket (meme idee que dans
// l'app agence-partenaire) : branche l'ID du client connecte depuis le
// store Redux et expose des hooks prets a l'emploi pour rafraichir les
// donnees a chaque evenement temps reel.

/**
 * Ecoute tous les evenements temps reel du client et declenche `onUpdate`
 * a chaque changement.
 *
 * @param {Function} onUpdate - Appele avec (data, meta, eventType).
 * @param {Object} options
 * @param {Array<string>} options.only - Restreindre a certains types ('expeditions', 'colis', 'offres').
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
      console.log(`🔄 [RealtimeUpdates] ${eventType}`, meta);
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
  };

  useWebSocket(user?.id, handlers, enabled && isAuthenticated && !!user?.id);
}

/**
 * Suivi temps reel d'une seule expedition (page de suivi / tracking).
 * Ne declenche `onUpdate` que si l'evenement concerne `expeditionId`.
 */
export function useRealtimeExpedition(expeditionId, onUpdate, enabled = true) {
  const handle = useCallback(
    (data, meta, eventType) => {
      const ids = meta?.ids || [];
      const refs = meta?.references || [];
      if (
        !expeditionId ||
        ids.includes(expeditionId) ||
        refs.includes(expeditionId)
      ) {
        onUpdate?.(data, meta, eventType);
      }
    },
    [expeditionId, onUpdate]
  );

  useRealtimeUpdates(handle, { only: ['expeditions', 'colis', 'offres'], enabled });
}

/**
 * Version avec notifications toast automatiques (sonner).
 */
export function useRealtimeWithNotifications(onUpdate, options = {}) {
  const handle = useCallback(
    (data, meta, eventType) => {
      switch (eventType) {
        case 'expedition.status_changed':
          toast.info('Le statut de votre colis a ete mis a jour');
          break;
        case 'expedition.payment_confirmed':
          toast.success('Paiement confirme');
          break;
        case 'expedition.delivered':
          toast.success('Votre colis a ete livre 🎉');
          break;
        case 'delivery_offer.received':
          toast.info('Un livreur a fait une offre pour votre colis');
          break;
        case 'colis.status_changed':
          toast.info('Mise a jour du suivi de votre colis');
          break;
        default:
          break;
      }
      onUpdate?.(data, meta, eventType);
    },
    [onUpdate]
  );

  return useRealtimeUpdates(handle, options);
}

export default useRealtimeUpdates;
