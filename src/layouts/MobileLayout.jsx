import { Suspense, lazy } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from '../components/common/BottomNav';
import InstallPrompt from '../components/common/InstallPrompt';
import PushNotificationPrompt from '../components/common/PushNotificationPrompt';
import useBottomNavHidden from '../hooks/useBottomNavHidden';

// Guest-first: the auth sheet is only mounted-visible on demand. Lazy-loading it
// keeps its deps (react-phone-number-input + bundled country flags) out of the
// initial bundle.
const AuthSheet = lazy(() => import('../components/auth/AuthSheet'));

export default function MobileLayout() {
  // Parcours plein ecran (envoi d'un colis, mise en vente...) : pas de navigation du bas.
  const immersive = useBottomNavHidden();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-surface-50">
      <main
        className={`flex-1 ${immersive
          ? 'pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+1.5rem)]'
          : 'pb-[calc(theme(spacing.bottom-nav)+max(0.75rem,env(safe-area-inset-bottom))+2rem)]'}`}
      >
        <Outlet />
      </main>
      {!immersive && <BottomNav />}
      {!immersive && <InstallPrompt />}
      {!immersive && <PushNotificationPrompt />}
      <Suspense fallback={null}>
        <AuthSheet />
      </Suspense>
    </div>
  );
}
