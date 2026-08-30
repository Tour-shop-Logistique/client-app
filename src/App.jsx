import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Routes, Route } from 'react-router-dom';
import MobileLayout from './layouts/MobileLayout';
import { ROUTES } from './routes';
import authService from './services/authService';
import { restoreSession } from './store/slices/authSlice';
import { getEcho, disconnectEcho } from './services/echo';
import { useRealtimeWithNotifications } from './hooks/useRealtimeUpdates';
import { isFeatureReady } from './config/features';
import WelcomeOnboarding from './pages/Onboarding/WelcomeOnboarding';
import { hasSeenOnboarding } from './utils/onboarding';

import HomePage from './pages/Home/HomePage';
import NewExpeditionPage from './pages/Expedition/NewExpeditionPage';
import IntervilleFormPage from './pages/Expedition/IntervilleFormPage';
import ExtrapaysFormPage from './pages/Expedition/ExtrapaysFormPage';
import TrackingPage from './pages/Expedition/TrackingPage';
import HistoryPage from './pages/Expedition/HistoryPage';
import ExpeditionDetailPage from './pages/Expedition/ExpeditionDetailPage';
import ProductListPage from './pages/Marketplace/ProductListPage';
import ProductDetailPage from './pages/Marketplace/ProductDetailPage';
import CartPage from './pages/Marketplace/CartPage';
import SellPage from './pages/Marketplace/SellPage';
import MyListingsPage from './pages/Marketplace/MyListingsPage';
import AgencyListPage from './pages/Agencies/AgencyListPage';
import AgencyDetailPage from './pages/Agencies/AgencyDetailPage';
import ProfilePage from './pages/Profile/ProfilePage';
import ReferralPage from './pages/Profile/ReferralPage';
import InvoicesPage from './pages/Profile/InvoicesPage';
import PageUnavailable from './pages/PageUnavailable';
import NotFoundPage from './pages/NotFoundPage';

// Renders the real page only if its backend is wired (src/config/features.js),
// otherwise the "Page non disponible" screen.
const gated = (featureKey, element) => (isFeatureReady(featureKey) ? element : <PageUnavailable />);

export default function App() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());

  // Restore the session from a stored Sanctum token via GET /api/profil.
  useEffect(() => {
    if (authService.getStoredToken()) dispatch(restoreSession());
  }, [dispatch]);

  // WebSocket (Laravel Reverb) : ouvre la connexion Echo des que le client
  // est authentifie, la ferme a la deconnexion. Meme approche que l'app
  // agence-partenaire (cf. src/services/echo.js).
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    getEcho();
    return () => disconnectEcho();
  }, [isAuthenticated]);

  // Ecoute globale : toasts automatiques sur les evenements temps reel
  // (statut colis, paiement, offres livreurs) quelle que soit la page.
  useRealtimeWithNotifications();

  if (showOnboarding) {
    return <WelcomeOnboarding onFinish={() => setShowOnboarding(false)} />;
  }

  return (
    <Routes>
      <Route element={<MobileLayout />}>
        <Route path={ROUTES.HOME} element={gated('home', <HomePage />)} />

        <Route path={ROUTES.EXPEDITION_NEW} element={gated('expeditionNew', <NewExpeditionPage />)} />
        <Route path={ROUTES.EXPEDITION_INTERVILLE} element={gated('expeditionInterville', <IntervilleFormPage />)} />
        <Route path={ROUTES.EXPEDITION_EXTRAPAYS} element={gated('expeditionExtrapays', <ExtrapaysFormPage />)} />
        <Route path={ROUTES.EXPEDITION_TRACKING} element={gated('expeditionTracking', <TrackingPage />)} />
        <Route path={ROUTES.EXPEDITION_HISTORY} element={gated('expeditionHistory', <HistoryPage />)} />
        <Route path={ROUTES.EXPEDITION_DETAIL} element={gated('expeditionHistory', <ExpeditionDetailPage />)} />

        <Route path={ROUTES.MARKETPLACE} element={gated('marketplace', <ProductListPage />)} />
        <Route path={ROUTES.MARKETPLACE_PRODUCT} element={gated('marketplace', <ProductDetailPage />)} />
        <Route path={ROUTES.MARKETPLACE_CART} element={gated('marketplace', <CartPage />)} />
        <Route path={ROUTES.MARKETPLACE_SELL} element={gated('marketplace', <SellPage />)} />
        <Route path={ROUTES.MARKETPLACE_MY_LISTINGS} element={gated('marketplace', <MyListingsPage />)} />

        <Route path={ROUTES.AGENCIES} element={gated('agencies', <AgencyListPage />)} />
        <Route path={ROUTES.AGENCY_DETAIL} element={gated('agencies', <AgencyDetailPage />)} />

        <Route path={ROUTES.PROFILE} element={gated('profile', <ProfilePage />)} />
        <Route path={ROUTES.PROFILE_REFERRAL} element={gated('referral', <ReferralPage />)} />
        <Route path={ROUTES.PROFILE_INVOICES} element={gated('invoices', <InvoicesPage />)} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
