import { History } from 'lucide-react';

// Signale qu'une saisie precedente a ete restauree (useFormDraft / draftStore).
export default function DraftRestoredBanner({ onReset, className = '' }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl bg-primary-50 px-3 py-2 text-caption text-primary-900 ${className}`}>
      <History size={14} className="shrink-0" />
      <span className="flex-1">Votre saisie précédente a été restaurée.</span>
      <button type="button" onClick={onReset} className="font-semibold text-primary-700 underline">
        Tout effacer
      </button>
    </div>
  );
}
