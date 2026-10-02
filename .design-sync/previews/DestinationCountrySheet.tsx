import { useEffect, useState } from 'react';
import { DestinationCountrySheet } from 'client-app';

// The sheet portals into #sheet-root and is position:fixed; this frame keeps it inside the card.
const SheetFrame = ({ children }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div style={{ transform: 'translateZ(0)', width: 400, height: 620 }} className="relative overflow-hidden bg-surface-50">
      <div id="sheet-root" />
      {ready && children}
    </div>
  );
};

const destinations = [
  { code_pays: 'FR', ld: true, groupage_dhd_aerien: true, groupage_dhd_maritime: true },
  { code_pays: 'BE', ld: true, groupage_dhd_aerien: true },
  { code_pays: 'CA', groupage_ca: true },
  { code_pays: 'SN', groupage_afrique: true, ld: true },
  { code_pays: 'CI', groupage_afrique: true },
  { code_pays: 'US', groupage_dhd_aerien: true },
];

export const Liste = () => (
  <SheetFrame>
    <DestinationCountrySheet open onClose={() => {}} destinations={destinations} status="idle" currentCode="FR" onSelect={() => {}} />
  </SheetFrame>
);

export const Erreur = () => (
  <SheetFrame>
    <DestinationCountrySheet open onClose={() => {}} destinations={[]} status="error" onSelect={() => {}} onRetry={() => {}} />
  </SheetFrame>
);
