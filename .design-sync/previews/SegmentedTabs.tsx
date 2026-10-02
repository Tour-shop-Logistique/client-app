import { useState } from 'react';
import { SegmentedTabs } from 'client-app';

export const Commandes = () => {
  const [value, setValue] = useState('a_payer');
  return (
    <div className="max-w-md bg-surface-50 px-4 py-3">
      <SegmentedTabs
        id="commandes"
        value={value}
        onChange={setValue}
        tabs={[
          { key: 'toutes', label: 'Toutes' },
          { key: 'a_payer', label: 'À payer', count: 2 },
          { key: 'en_cours', label: 'En cours', count: 1 },
          { key: 'livrees', label: 'Livrées' },
        ]}
      />
    </div>
  );
};

export const Annonces = () => {
  const [value, setValue] = useState('en_ligne');
  return (
    <div className="max-w-md bg-surface-50 px-4 py-3">
      <SegmentedTabs
        id="annonces"
        value={value}
        onChange={setValue}
        tabs={[
          { key: 'en_ligne', label: 'En ligne', count: 6 },
          { key: 'brouillons', label: 'Brouillons', count: 1 },
          { key: 'vendues', label: 'Vendues' },
        ]}
      />
    </div>
  );
};
