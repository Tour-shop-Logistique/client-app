import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import api from './api';

// Meme approche que l'app agence-partenaire : une seule instance Echo
// partagee (singleton), connexion Reverb, autorisation des canaux prives
// deleguee a l'API Laravel existante via POST /broadcasting/auth (token Sanctum).

window.Pusher = Pusher;

let echoInstance = null;

/**
 * Cree et retourne l'instance Echo pour le WebSocket.
 * @returns {Echo|null} Instance Echo, ou null si aucun token n'est disponible.
 */
export function getEcho() {
  if (echoInstance) {
    return echoInstance;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('[Echo] Impossible de creer Echo : aucun token disponible');
    return null;
  }

  console.log('[Echo] Initialisation de la connexion WebSocket...');

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: import.meta.env.VITE_REVERB_PORT,
    wssPort: import.meta.env.VITE_REVERB_PORT,
    forceTLS: import.meta.env.VITE_REVERB_SCHEME === 'https',
    enabledTransports: ['ws', 'wss'],

    // Authentification custom : on reutilise l'instance axios `api`
    // (baseURL `/api`, header Authorization: Bearer <token> injecte par
    // l'intercepteur) pour autoriser chaque canal prive.
    authorizer: (channel) => ({
      authorize(socketId, callback) {
        api
          .post('/broadcasting/auth', {
            socket_id: socketId,
            channel_name: channel.name,
          })
          .then((res) => {
            console.log('[Echo] Canal autorise :', channel.name);
            callback(false, res.data);
          })
          .catch((err) => {
            console.error('[Echo] Erreur d\'autorisation :', err);
            callback(true, err);
          });
      },
    }),
  });

  // Evenements de connexion (utile en debug)
  const connection = echoInstance.connector.pusher.connection;

  connection.bind('connected', () => {
    console.log('✅ [Echo] WebSocket connecte');
    console.log('📊 [Echo] Socket ID :', echoInstance.socketId());
  });

  connection.bind('disconnected', () => {
    console.warn('⚠️ [Echo] WebSocket deconnecte');
  });

  connection.bind('error', (err) => {
    console.error('❌ [Echo] Erreur WebSocket :', err);
  });

  connection.bind('state_change', (states) => {
    console.log('🔄 [Echo] Changement d\'etat :', states.previous, '→', states.current);
  });

  return echoInstance;
}

/**
 * Deconnecte et reinitialise l'instance Echo (a appeler a la deconnexion).
 */
export function disconnectEcho() {
  if (echoInstance) {
    console.log('[Echo] Deconnexion en cours...');
    echoInstance.disconnect();
    echoInstance = null;
  }
}

/**
 * Reinitialise Echo (utile apres un changement de token).
 */
export function resetEcho() {
  disconnectEcho();
  return getEcho();
}
