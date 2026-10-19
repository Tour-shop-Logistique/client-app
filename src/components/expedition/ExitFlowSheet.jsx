import { LogOut, Trash2 } from 'lucide-react';
import BottomSheet from '../common/BottomSheet';

// Confirmation avant de quitter un envoi non enregistré.
// Trois issues : continuer (par défaut), quitter en gardant la saisie sur
// l'appareil (brouillon repris au retour), ou abandonner et tout effacer.
export default function ExitFlowSheet({ open, progress, amount, onStay, onKeep, onDiscard }) {
  return (
    <BottomSheet open={open} onClose={onStay} title="Quitter l'envoi ?">
      <div className="space-y-4">
        <p className="text-body text-surface-600">
          Votre envoi n'est pas encore enregistré : l'agence ne l'a pas reçu.
        </p>

        {(progress || amount) && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-50 px-3.5 py-3 text-sm">
            <span className="min-w-0 text-surface-600">{progress}</span>
            {amount && <span className="shrink-0 font-heading font-bold text-primary-700">{amount}</span>}
          </div>
        )}

        <div className="space-y-2">
          <button type="button" className="btn-primary h-12 w-full" onClick={onStay}>
            Continuer mon envoi
          </button>
          <button type="button" className="btn-secondary h-12 w-full" onClick={onKeep}>
            <LogOut size={16} /> Quitter, je reprendrai plus tard
          </button>
          <p className="px-1 text-center text-caption text-surface-400">
            Votre saisie reste enregistrée sur cet appareil.
          </p>
          <button type="button" className="btn h-12 w-full text-red-600 hover:bg-red-50" onClick={onDiscard}>
            <Trash2 size={16} /> Abandonner et tout effacer
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
