import { useState } from 'react';
import { ContactFields } from 'client-app';

const empty = { nom_prenom: '', telephone: '', adresse: '', ville: '', email: '', societe: '', code_postal: '', etat: '', quartier: '' };

export const Expediteur = () => {
  const [data, setData] = useState({ ...empty, nom_prenom: 'Jean Kouassi', telephone: '0102030405', adresse: 'Rue 12, Cocody', ville: 'Cocody' });
  return (
    <div className="max-w-md">
      <ContactFields
        title="Expéditeur"
        data={data}
        onChange={setData}
        communes={[{ id: 1, nom: 'Cocody' }, { id: 2, nom: 'Yopougon' }, { id: 3, nom: 'Plateau' }]}
      />
    </div>
  );
};

export const Destinataire = () => {
  const [data, setData] = useState({ ...empty, nom_prenom: 'Awa Traoré' });
  return (
    <div className="max-w-md">
      <ContactFields title="Destinataire" data={data} onChange={setData} villeFixed="Bouaké" />
    </div>
  );
};
