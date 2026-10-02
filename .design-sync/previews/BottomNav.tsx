import { BottomNav } from 'client-app';

// BottomNav is position:fixed to the viewport bottom; a transformed box anchors it in the cell.
export const Accueil = () => (
  <div style={{ transform: 'translateZ(0)', height: 120, maxWidth: 448 }} className="relative bg-surface-50">
    <BottomNav />
  </div>
);
