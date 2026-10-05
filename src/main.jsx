import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { store } from './store';
import { sessionExpired } from './store/slices/authSlice';
import { abonnementBloqueDetected } from './store/slices/marketplaceSlice';
import { ROUTES } from './routes';
import App from './App.jsx';
import './index.css';
// Side-effect import: registers the `beforeinstallprompt` listener before React mounts.
import './hooks/usePwaInstall';
import { registerPwaUpdates } from './utils/pwaUpdate';

// Echeance d'abonnement depassee : le 401 vient tres probablement de la
// revocation des tokens au blocage (NOTIFICATIONS_A_INTEGRER.md, famille 2).
const abonnementOverdue = () => {
  const { bloque, echeanceCourante } = store.getState().marketplace.abonnement;
  const fin = Date.parse(echeanceCourante?.periode_fin ?? '');
  return bloque || echeanceCourante?.statut === 'en_retard' || (Number.isFinite(fin) && fin < Date.now());
};

// The API interceptor fires this on any 401 (revoked/expired Sanctum token,
// e.g. after reset-password wipes every token) — drop the session store-side.
window.addEventListener('auth:unauthorized', () => {
  const wasLoggedIn = store.getState().auth.isAuthenticated;
  const blocked = wasLoggedIn && abonnementOverdue();
  store.dispatch(sessionExpired());
  if (blocked) {
    toast.warning('Session fermée : abonnement marketplace en retard', {
      description: 'Reconnectez-vous pour régulariser. Vos expéditions et achats restent accessibles.',
      duration: 15000,
      action: { label: 'Régulariser', onClick: () => window.location.assign(ROUTES.MARKETPLACE_SUBSCRIPTION) },
    });
  }
});
// 403 ABONNEMENT_BLOQUE sur une route vendeur : le bandeau d'abonnement s'affiche.
window.addEventListener('marketplace:abonnement-bloque', () => store.dispatch(abonnementBloqueDetected()));

registerPwaUpdates();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster position="top-center" richColors closeButton />
      </BrowserRouter>
    </Provider>
  </StrictMode>
);
