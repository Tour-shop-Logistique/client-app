import { useEffect, useState, Suspense, lazy } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import MobileLayout from './layouts/MobileLayout';
import LoadingSpinner from './components/common/LoadingSpinner';
import { ROUTES } from './routes';
import authService from './services/authService';
import { restoreSession } from './store/slices/authSlice';
import { abonnementBloqueDetected, fetchAbonnementStatut } from './store/slices/marketplaceSlice';
import { getEcho, disconnectEcho } from './services/echo';
import { useRealtimeWithNotifications } from './hooks/useRealtimeUpdates';
import { isFeatureReady } from './config/features';
import WelcomeOnboarding from './pages/Onboarding/WelcomeOnboarding';
import { hasSeenOnboarding } from './utils/onboarding';

import HomePage from './pages/Home/HomePage';
import NewExpeditionPage from './pages/Expedition/NewExpeditionPage';
import IntervilleFormPage from './pages/Expedition/IntervilleFormPage';
import ExtrapaysFormPage from './pages/Expedition/ExtrapaysFormPage';
import HistoryPage from './pages/Expedition/HistoryPage';
import ExpeditionDetailPage from './pages/Expedition/ExpeditionDetailPage';
import ProductListPage from './pages/Marketplace/ProductListPage';
import ProductDetailPage from './pages/Marketplace/ProductDetailPage';
import CartPage from './pages/Marketplace/CartPage';
import SellerOnly from './components/marketplace/SellerOnly';
import AgencyListPage from './pages/Agencies/AgencyListPage';
import AgencyDetailPage from './pages/Agencies/AgencyDetailPage';
import ProfilePage from './pages/Profile/ProfilePage';
import ReferralPage from './pages/Profile/ReferralPage';
import InvoicesPage from './pages/Profile/InvoicesPage';
import PageUnavailable from './pages/PageUnavailable';
import NotFoundPage from './pages/NotFoundPage';

// Secondary account screens — lazy so their deps (react-phone-number-input +
// bundled country flags, shared with AuthSheet) stay out of the initial bundle.
const EditProfilePage = lazy(() => import('./pages/Profile/EditProfilePage'));
const ChangePasswordPage = lazy(() => import('./pages/Profile/ChangePasswordPage'));
const FavoriteAddressesPage = lazy(() => import('./pages/Profile/FavoriteAddressesPage'));
const DeleteAccountPage = lazy(() => import('./pages/Profile/DeleteAccountPage'));

// Marketplace : achats, espace vendeur et abonnement (secondaires, charges a la demande).
const FavoritesPage = lazy(() => import('./pages/Marketplace/FavoritesPage'));
const OrdersPage = lazy(() => import('./pages/Marketplace/OrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/Marketplace/OrderDetailPage'));
const SellerHubPage = lazy(() => import('./pages/Marketplace/SellerHubPage'));
const SellPage = lazy(() => import('./pages/Marketplace/SellPage'));
const MyListingsPage = lazy(() => import('./pages/Marketplace/MyListingsPage'));
const ListingEditPage = lazy(() => import('./pages/Marketplace/ListingEditPage'));
const SalesPage = lazy(() => import('./pages/Marketplace/SalesPage'));
const SaleDetailPage = lazy(() => import('./pages/Marketplace/SaleDetailPage'));
const PaymentMethodsPage = lazy(() => import('./pages/Marketplace/PaymentMethodsPage'));
const BalancePage = lazy(() => import('./pages/Marketplace/BalancePage'));
const SubscriptionPage = lazy(() => import('./pages/Marketplace/SubscriptionPage'));

// Renders the real page only if its backend is wired (src/config/features.js),
// otherwise the "Page non disponible" screen.
const gated = (featureKey, element) => (isFeatureReady(featureKey) ? element : <PageUnavailable />);

export default function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
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
  // (statut colis, paiement, offres livreurs, marketplace) quelle que soit la page.
  useRealtimeWithNotifications();

  // Push recu app ouverte (relaye par public/push-sw.js) : toast in-app et
  // resynchronisation de l'abonnement marketplace s'il est concerne.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (event) => {
      if (event.data?.type !== 'push') return;
      const p = event.data.payload || {};
      const url = p.data?.url || p.url;
      toast.info(p.title || 'TourShop', {
        description: p.body,
        action: url ? { label: 'Voir', onClick: () => (/^https?:/i.test(url) ? window.location.assign(url) : navigate(url)) } : undefined,
      });
      const text = `${p.title || ''} ${p.body || ''} ${p.data?.type || ''}`.toLowerCase();
      if (/abonnement/.test(text)) {
        if (/(bloqu|suspendu)/.test(text)) dispatch(abonnementBloqueDetected());
        if (isAuthenticated) dispatch(fetchAbonnementStatut());
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [dispatch, navigate, isAuthenticated]);

  if (showOnboarding) {
    return <WelcomeOnboarding onFinish={() => setShowOnboarding(false)} />;
  }

  return (
    <Suspense fallback={<div className="page-container py-10"><LoadingSpinner /></div>}>
      <Routes>
      <Route element={<MobileLayout />}>
        <Route path={ROUTES.HOME} element={gated('home', <HomePage />)} />

        <Route path={ROUTES.EXPEDITION_NEW} element={gated('expeditionNew', <NewExpeditionPage />)} />
        <Route path={ROUTES.EXPEDITION_INTERVILLE} element={gated('expeditionInterville', <IntervilleFormPage />)} />
        <Route path={ROUTES.EXPEDITION_EXTRAPAYS} element={gated('expeditionExtrapays', <ExtrapaysFormPage />)} />
        {/* Ancienne URL de suivi : le suivi fait partie du detail d'expedition. */}
        <Route path={ROUTES.EXPEDITION_TRACKING} element={gated('expeditionHistory', <ExpeditionDetailPage />)} />
        <Route path={ROUTES.EXPEDITION_HISTORY} element={gated('expeditionHistory', <HistoryPage />)} />
        <Route path={ROUTES.EXPEDITION_DETAIL} element={gated('expeditionHistory', <ExpeditionDetailPage />)} />

        <Route path={ROUTES.MARKETPLACE} element={gated('marketplace', <ProductListPage />)} />
        <Route path={ROUTES.MARKETPLACE_PRODUCT} element={gated('marketplace', <ProductDetailPage />)} />
        <Route path={ROUTES.MARKETPLACE_CART} element={gated('marketplace', <CartPage />)} />
        <Route path={ROUTES.MARKETPLACE_FAVORITES} element={gated('marketplace', <FavoritesPage />)} />
        <Route path={ROUTES.MARKETPLACE_ORDERS} element={gated('marketplace', <OrdersPage />)} />
        <Route path={ROUTES.MARKETPLACE_ORDER} element={gated('marketplace', <OrderDetailPage />)} />
        <Route path={ROUTES.MARKETPLACE_SELLER} element={gated('marketplace', <SellerHubPage />)} />
        <Route path={ROUTES.MARKETPLACE_SELL} element={gated('marketplace', <SellPage />)} />
        <Route path={ROUTES.MARKETPLACE_MY_LISTINGS} element={gated('marketplace', <SellerOnly><MyListingsPage /></SellerOnly>)} />
        <Route path={ROUTES.MARKETPLACE_LISTING_EDIT} element={gated('marketplace', <SellerOnly><ListingEditPage /></SellerOnly>)} />
        <Route path={ROUTES.MARKETPLACE_SALES} element={gated('marketplace', <SellerOnly><SalesPage /></SellerOnly>)} />
        <Route path={ROUTES.MARKETPLACE_SALE} element={gated('marketplace', <SellerOnly><SaleDetailPage /></SellerOnly>)} />
        <Route path={ROUTES.MARKETPLACE_PAYMENT_METHODS} element={gated('marketplace', <SellerOnly><PaymentMethodsPage /></SellerOnly>)} />
        <Route path={ROUTES.MARKETPLACE_BALANCE} element={gated('marketplace', <SellerOnly><BalancePage /></SellerOnly>)} />
        <Route path={ROUTES.MARKETPLACE_SUBSCRIPTION} element={gated('marketplace', <SubscriptionPage />)} />

        <Route path={ROUTES.AGENCIES} element={gated('agencies', <AgencyListPage />)} />
        <Route path={ROUTES.AGENCY_DETAIL} element={gated('agencies', <AgencyDetailPage />)} />

        <Route path={ROUTES.PROFILE} element={gated('profile', <ProfilePage />)} />
        <Route path={ROUTES.PROFILE_EDIT} element={gated('profile', <EditProfilePage />)} />
        <Route path={ROUTES.PROFILE_PASSWORD} element={gated('profile', <ChangePasswordPage />)} />
        <Route path={ROUTES.PROFILE_ADDRESSES} element={gated('profile', <FavoriteAddressesPage />)} />
        <Route path={ROUTES.PROFILE_DELETE} element={gated('profile', <DeleteAccountPage />)} />
        <Route path={ROUTES.PROFILE_REFERRAL} element={gated('referral', <ReferralPage />)} />
        <Route path={ROUTES.PROFILE_INVOICES} element={gated('invoices', <InvoicesPage />)} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
      </Routes>
    </Suspense>
  );
}
