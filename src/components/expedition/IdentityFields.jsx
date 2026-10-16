import { IdCard } from 'lucide-react';
import { identityExpired } from '../../utils/contact';

// Pièce d'identité de l'expéditeur. `data` : { numero_piece_identite,
// date_expiration_piece_identite } ; helpers dans src/utils/contact.js.
export default function IdentityFields({ data, onChange }) {
  const set = (field) => (e) => onChange({ ...data, [field]: e.target.value });
  const expired = identityExpired(data);

  return (
    <div className="space-y-3 border-t border-surface-100 pt-3">
      <p className="flex items-center gap-2 text-sm font-medium text-surface-700">
        <IdCard size={16} className="text-primary-600" /> Pièce d'identité de l'expéditeur
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-surface-600">
          Numéro de la pièce
          <input
            className="input-field mt-1.5"
            placeholder="Ex: CI001234567"
            maxLength={50}
            autoComplete="off"
            value={data.numero_piece_identite ?? ''}
            onChange={set('numero_piece_identite')}
          />
        </label>
        <label className="block text-xs font-medium text-surface-600">
          Date d'expiration
          <input
            type="date"
            className={`input-field mt-1.5 ${expired ? 'border-red-400' : ''}`}
            value={data.date_expiration_piece_identite ?? ''}
            onChange={set('date_expiration_piece_identite')}
          />
        </label>
      </div>
      {expired && <p className="text-xs text-red-600">Cette pièce d'identité est expirée.</p>}
    </div>
  );
}
