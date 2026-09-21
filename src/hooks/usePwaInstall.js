import { useCallback, useEffect, useSyncExternalStore } from 'react';

// PWA install flow. Chromium/Android fire `beforeinstallprompt` once, possibly
// before React mounts, so the listener lives at module level (this file is
// imported from main.jsx) and the hook just subscribes to the stored event.
// iOS Safari has no such event: there we only show manual "Add to Home Screen"
// instructions.

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_DAYS = 7;

let deferredPrompt = null;
let installed = false;
const listeners = new Set();
let snapshot = null;

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

const recentlyDismissed = () => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

const compute = () => {
  const standalone = isStandalone();
  const ios = isIos();
  return {
    // Native prompt available (Chrome/Edge/Android/Samsung Internet).
    canPrompt: !!deferredPrompt && !installed,
    // iOS Safari: manual instructions only.
    showIosHelp: ios && !standalone && !installed,
    installed: installed || standalone,
    dismissed: recentlyDismissed(),
  };
};

const emit = () => {
  snapshot = compute();
  listeners.forEach((l) => l());
};

if (typeof window !== 'undefined') {
  snapshot = compute();
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    emit();
  });
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => snapshot;

export default function usePwaInstall() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Re-evaluate when the app switches display mode (e.g. installed then opened).
  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)');
    mq?.addEventListener?.('change', emit);
    return () => mq?.removeEventListener?.('change', emit);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return null;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null; // a prompt event can only be used once
    emit();
    return outcome;
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage unavailable — dismissal lasts until reload */
    }
    emit();
  }, []);

  return { ...state, install, dismiss };
}
