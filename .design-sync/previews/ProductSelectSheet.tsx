import { useEffect, useState } from 'react';
import { ProductSelectSheet } from 'client-app';

// The sheet portals into #sheet-root and is position:fixed; this frame keeps it inside the card.
const SheetFrame = ({ children }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div style={{ transform: 'translateZ(0)', width: 400, height: 580 }} className="relative overflow-hidden bg-surface-50">
      <div id="sheet-root" />
      {ready && children}
    </div>
  );
};

const products = [
  { id: 1, designation: 'Vêtements (carton standard)', reference: 'VET-01', category: { nom: 'Textile' } },
  { id: 2, designation: 'Téléphone portable', reference: 'ELE-04', category: { nom: 'Électronique' } },
  { id: 3, designation: 'Ordinateur portable', reference: 'ELE-07', category: { nom: 'Électronique' } },
  { id: 4, designation: 'Produits cosmétiques', reference: 'COS-02', category: { nom: 'Beauté' } },
  { id: 5, designation: 'Denrées sèches (attiéké, gari)', reference: 'ALI-03', category: { nom: 'Alimentaire' } },
];

export const Liste = () => (
  <SheetFrame>
    <ProductSelectSheet open onClose={() => {}} products={products} status="idle" onSelect={() => {}} />
  </SheetFrame>
);

export const Chargement = () => (
  <SheetFrame>
    <ProductSelectSheet open onClose={() => {}} products={[]} status="loading" onSelect={() => {}} />
  </SheetFrame>
);
