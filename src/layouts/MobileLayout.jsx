import { Suspense, lazy } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from '../components/common/BottomNav';

// Guest-first: the auth sheet is only mounted-visible on demand. Lazy-loading it
// keeps its deps (react-phone-number-input + bundled country flags) out of the
// initial bundle.
const AuthSheet = lazy(() => import('../components/auth/AuthSheet'));

export default function MobileLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-surface-50">
      <main className="flex-1 pb-[calc(theme(spacing.bottom-nav)+env(safe-area-inset-bottom)+1rem)]">
        <Outlet />
      </main>
      <BottomNav />
      <Suspense fallback={null}>
        <AuthSheet />
      </Suspense>
    </div>
  );
}
