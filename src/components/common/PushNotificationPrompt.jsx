import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Bell, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import usePushSubscription from '../../hooks/usePushSubscription';
import usePwaInstall from '../../hooks/usePwaInstall';

// Invitation à activer les notifications (INTEGRATION_PUSH_NOTIFICATIONS_REACT.md,
// section 3). Bannière flottante, comme celle d'installation, affichée seulement :
//  - une fois connecté (l'abonnement est rattaché au compte) ;
//  - si le navigateur gère le push et que la permission n'a pas encore été
//    demandée (`default`) — jamais après un accord ou un refus ;
//  - tant que l'appareil n'est pas abonné ;
//  - une fois par session (« Plus tard » la masque jusqu'à la prochaine ouverture) ;
//  - pas en même temps que l'invitation à installer l'app (celle-ci passe d'abord).
const DISMISS_KEY = 'push-prompt-dismissed';

const wasDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

export default function PushNotificationPrompt() {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const { supported, ready, enabled, loading, permission, toggle } = usePushSubscription();
  const install = usePwaInstall();
  const [dismissed, setDismissed] = useState(wasDismissed);

  const installBannerVisible = !install.installed && !install.dismissed && (install.canPrompt || install.showIosHelp);

  if (!isAuthenticated || !supported || !ready || permission !== 'default' || enabled || dismissed || installBannerVisible) {
    return null;
  }

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* stockage indisponible : la bannière revient au prochain chargement */
    }
    setDismissed(true);
  };

  const activate = async () => {
    const res = await toggle();
    if (res.ok) toast.success('Notifications activées sur cet appareil.');
    else toast.error(res.message || 'Activation impossible.');
  };

  return (
    <div
      role="dialog"
      aria-label="Activer les notifications"
      className="fixed inset-x-0 bottom-[calc(theme(spacing.bottom-nav)+max(0.75rem,env(safe-area-inset-bottom))+1.25rem)] z-40 mx-auto max-w-md px-3"
    >
      <div className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-lg ring-1 ring-surface-200">
        <span className="icon-tile h-11 w-11 shrink-0 rounded-xl bg-amber-100 text-amber-700">
          <Bell size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-surface-900">Activer les notifications</p>
          <p className="mt-0.5 text-xs text-surface-500">
            Soyez alerté de l’avancée de vos colis et de vos commandes, même quand l’application est fermée.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={activate} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />} Activer
            </button>
            <button type="button" className="px-2 py-2 text-sm font-medium text-surface-500" onClick={dismiss} disabled={loading}>
              Plus tard
            </button>
          </div>
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
