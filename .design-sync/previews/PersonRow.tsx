import { PersonRow } from 'client-app';

export const VendeurEtAcheteur = () => (
  <div className="card max-w-md space-y-4 p-4">
    <PersonRow label="Vendeur" person={{ prenoms: 'Mariam', nom: 'Coulibaly' }} />
    <PersonRow label="Acheteur" person={{ prenoms: 'Jean-Marc', nom: 'Kouadio' }} />
  </div>
);
