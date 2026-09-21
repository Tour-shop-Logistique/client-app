import { Download, Share, X } from 'lucide-react';
import usePwaInstall from '../../hooks/usePwaInstall';

// Bottom banner inviting the user to install the PWA. Hidden once installed,
// when running standalone, or for 7 days after being dismissed.
export default function InstallPrompt() {
  const { canPrompt, showIosHelp, installed, dismissed, install, dismiss } = usePwaInstall();

  if (installed || dismissed || (!canPrompt && !showIosHelp)) return null;

  return (
    <div
      role="dialog"
      aria-label="Installer l'application"
      className="fixed inset-x-0 bottom-[calc(theme(spacing.bottom-nav)+env(safe-area-inset-bottom)+0.5rem)] z-40 mx-auto max-w-md px-3"
    >
      <div className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-lg ring-1 ring-surface-200">
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-surface-900">Installer TourShop</p>
          {canPrompt ? (
            <>
              <p className="mt-0.5 text-xs text-surface-500">
                Accédez à l'application depuis votre écran d'accueil, même hors connexion.
              </p>
              <button type="button" className="btn-primary mt-2.5 px-4 py-2 text-sm" onClick={install}>
                <Download size={16} /> Installer
              </button>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-surface-500">
              Appuyez sur <Share size={13} className="mx-0.5 inline align-text-bottom" /> puis sur
              «&nbsp;Sur l'écran d'accueil&nbsp;».
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Fermer"
          className="-m-1 rounded-full p-1.5 text-surface-400 hover:bg-surface-100"
          onClick={dismiss}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
