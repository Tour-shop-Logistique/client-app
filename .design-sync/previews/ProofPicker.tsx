import { useState } from 'react';
import { ProofPicker } from 'client-app';

const receipt = new File(
  [`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220"><rect width="400" height="220" fill="#fff7ed"/><rect x="20" y="20" width="360" height="40" rx="8" fill="#f97316"/><text x="200" y="47" font-family="Arial" font-size="18" font-weight="700" fill="white" text-anchor="middle">Transfert réussi</text><text x="200" y="120" font-family="Arial" font-size="32" font-weight="700" fill="#0f172a" text-anchor="middle">45 500 FCFA</text><text x="200" y="170" font-family="Arial" font-size="14" fill="#64748b" text-anchor="middle">Réf. OM-240918-77412</text></svg>`],
  'preuve.svg',
  { type: 'image/svg+xml', lastModified: 1 },
);

export const Vide = () => {
  const [f, setF] = useState(null);
  return (
    <div className="max-w-sm">
      <ProofPicker file={f} onChange={setF} />
    </div>
  );
};

export const AvecPreuve = () => {
  const [f, setF] = useState(receipt);
  return (
    <div className="max-w-sm">
      <ProofPicker file={f} onChange={setF} />
    </div>
  );
};
