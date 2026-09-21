import { registerSW } from 'virtual:pwa-register';

// Service worker registration + update detection.
//
// With `registerType: 'autoUpdate'` a new worker installs, skips waiting, takes
// control and the page reloads itself. What browsers don't do reliably is
// *look* for a new worker: iOS standalone PWAs stay alive in memory for days and
// only re-check sw.js on a fresh navigation. So we poll explicitly, and above
// all re-check every time the app comes back to the foreground — the least
// disruptive moment to swap versions.

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const MIN_GAP_MS = 30 * 1000; // avoid hammering when focus/visibility fire together

export function registerPwaUpdates() {
  if (!('serviceWorker' in navigator)) return;

  let lastCheck = 0;
  let registration;

  const checkForUpdate = async () => {
    if (!registration || !navigator.onLine) return;
    const now = Date.now();
    if (now - lastCheck < MIN_GAP_MS) return;
    lastCheck = now;
    try {
      await registration.update(); // fetches sw.js bypassing the SW; installs if bytes changed
    } catch {
      /* offline or transient network error — retry on next trigger */
    }
  };

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      registration = reg;
      checkForUpdate();
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('focus', checkForUpdate);
  window.addEventListener('online', checkForUpdate);
  // iOS fires pageshow (persisted) when restoring the app from the bfcache.
  window.addEventListener('pageshow', (e) => e.persisted && checkForUpdate());
  setInterval(checkForUpdate, CHECK_INTERVAL_MS);
}
