import { useState } from 'react';
import { User } from 'lucide-react';

// Shared expediteur/destinataire block for the expedition forms.
// Shape + helpers (EMPTY_CONTACT, contactIsComplete, contactPayload) live in
// src/utils/contact.js.
export default function ContactFields({ title, data, onChange }) {
  const [showMore, setShowMore] = useState(false);
  const set = (field) => (e) => onChange({ ...data, [field]: e.target.value });

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <User size={18} className="text-primary-600" />
        <p className="font-semibold text-surface-900">{title}</p>
      </div>
      <label className="block text-sm font-medium text-surface-700">
        Nom et prenom
        <input className="input-field mt-1.5" placeholder="Ex: Jean Kouassi" value={data.nom_prenom} onChange={set('nom_prenom')} />
      </label>
      <label className="block text-sm font-medium text-surface-700">
        Telephone
        <input className="input-field mt-1.5" inputMode="tel" placeholder="Ex: 0102030405" value={data.telephone} onChange={set('telephone')} />
      </label>
      <label className="block text-sm font-medium text-surface-700">
        Adresse
        <input className="input-field mt-1.5" placeholder="Ex: Rue 12" value={data.adresse} onChange={set('adresse')} />
      </label>
      <label className="block text-sm font-medium text-surface-700">
        Ville
        <input className="input-field mt-1.5" placeholder="Ex: Bouake" value={data.ville} onChange={set('ville')} />
      </label>
      <button type="button" onClick={() => setShowMore((v) => !v)} className="text-xs font-semibold text-primary-600">
        {showMore ? 'Masquer les champs optionnels' : '+ Email, societe, code postal...'}
      </button>
      {showMore && (
        <div className="space-y-3 border-t border-surface-100 pt-3">
          <label className="block text-sm font-medium text-surface-700">
            Email (optionnel)
            <input type="email" className="input-field mt-1.5" value={data.email} onChange={set('email')} />
          </label>
          <label className="block text-sm font-medium text-surface-700">
            Societe (optionnel)
            <input className="input-field mt-1.5" value={data.societe} onChange={set('societe')} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-surface-600">
              Code postal
              <input className="input-field mt-1.5" value={data.code_postal} onChange={set('code_postal')} />
            </label>
            <label className="block text-xs font-medium text-surface-600">
              Etat / Region
              <input className="input-field mt-1.5" value={data.etat} onChange={set('etat')} />
            </label>
          </div>
          <label className="block text-sm font-medium text-surface-700">
            Quartier (optionnel)
            <input className="input-field mt-1.5" value={data.quartier} onChange={set('quartier')} />
          </label>
        </div>
      )}
    </div>
  );
}
