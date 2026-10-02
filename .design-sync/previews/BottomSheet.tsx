import { useEffect, useState } from 'react';
import { BottomSheet, MapPin, Store } from 'client-app';

// BottomSheet portals into #sheet-root and is position:fixed. This frame owns a
// #sheet-root inside a transformed box so the sheet renders within the card.
const SheetFrame = ({ children }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div style={{ transform: 'translateZ(0)', width: 400, height: 540 }} className="relative overflow-hidden bg-surface-50">
      <div id="sheet-root" />
      {ready && children}
    </div>
  );
};

export const ModeLivraison = () => (
  <SheetFrame>
    <BottomSheet open onClose={() => {}} title="Mode de livraison">
      <div className="space-y-2">
        <button type="button" className="flex w-full items-center gap-3 rounded-xl border-2 border-primary-600 bg-primary-50 p-3.5 text-left">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-primary-600"><MapPin size={18} /></span>
          <span>
            <span className="block text-body font-semibold text-surface-900">Livraison à domicile</span>
            <span className="block text-caption text-surface-500">Le colis est remis à l'adresse du destinataire</span>
          </span>
        </button>
        <button type="button" className="flex w-full items-center gap-3 rounded-xl border border-surface-200 p-3.5 text-left">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100 text-surface-600"><Store size={18} /></span>
          <span>
            <span className="block text-body font-semibold text-surface-900">Retrait en agence</span>
            <span className="block text-caption text-surface-500">Groupage Afrique, CA, DHD aérien ou maritime</span>
          </span>
        </button>
      </div>
      <button type="button" className="btn-primary mt-5 w-full">Continuer</button>
    </BottomSheet>
  </SheetFrame>
);
