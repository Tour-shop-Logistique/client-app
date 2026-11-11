import { IdCard } from 'lucide-react';
import { identityExpired, identityNumberMissing } from '../../utils/contact';

// Pièce d'identité de l'expéditeur. `data` : { numero_piece_identite,
// date_expiration_piece_identite } ; helpers dans src/utils/contact.js.
export default function IdentityFields({ data, onChange, showErrors = false }) {
  const set = (field) => (e) => onChange({ ...data, [field]: e.target.value });
  const expired = identityExpired(data);
  const missing = showErrors && identityNumberMissing(data);

  return (
    <div className="space-y-3 border-t border-surface-100 pt-3">
      <p className="flex items-center gap-2 text-sm font-medium text-surface-700">
        <IdCard size={16} className="text-primary-600" /> Pièce d'identité de l'expéditeur
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-surface-600">
          Numéro de la pièce *
          <input
            className={`input-field mt-1.5 ${missing ? 'border-red-400' : ''}`}
            required
            {...(missing ? { 'data-invalid': 'true', 'aria-invalid': true } : {})}
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
            {...(expired ? { 'data-invalid': 'true', 'aria-invalid': true } : {})}
            value={data.date_expiration_piece_identite ?? ''}
            onChange={set('date_expiration_piece_identite')}
          />
        </label>
      </div>
      {missing && <p className="text-xs text-red-600">Le numéro de la pièce d'identité est obligatoire.</p>}
      {expired && <p className="text-xs text-red-600">Cette pièce d'identité est expirée.</p>}
    </div>
  );
}
