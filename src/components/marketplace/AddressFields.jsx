import { useEffect } from 'react';
import { LocateFixed, Loader2, MapPin, Check } from 'lucide-react';
import useGeolocation from '../../hooks/useGeolocation';

// Helpers associes (EMPTY_ADDRESS, toRetraitPayload…) : utils/marketplace.js.

// Champs d'adresse partages (retrait vendeur / livraison acheteur).
// `value` : { nom, telephone, adresse, quartier, ville, latitude, longitude, instructions? }
// `required` : liste des champs obligatoires (marques d'un *).

export default function AddressFields({
  value, onChange, required = [], withInstructions = false, errors = {}, disabled = false, idPrefix = 'addr',
}) {
  const { position, loading, error, locate } = useGeolocation();
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });

  useEffect(() => {
    if (position) onChange({ ...value, latitude: position.lat, longitude: position.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  const field = (key, label, props = {}) => (
    <label className="block" htmlFor={`${idPrefix}-${key}`}>
      <span className="text-caption font-medium text-surface-600">
        {label}
        {required.includes(key) && <span className="text-red-600"> *</span>}
      </span>
      <input
        id={`${idPrefix}-${key}`}
        className={`input-field mt-1 ${errors[key] ? 'border-red-400' : ''}`}
        value={value[key] ?? ''}
        onChange={set(key)}
        disabled={disabled}
        {...props}
      />
      {errors[key] && <span className="mt-1 block text-caption text-red-600">{errors[key]}</span>}
    </label>
  );

  const located = value.latitude != null && value.longitude != null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {field('nom', 'Nom du contact', { maxLength: 255, autoComplete: 'name' })}
        {field('telephone', 'Téléphone', { maxLength: 20, inputMode: 'tel', autoComplete: 'tel' })}
      </div>
      {field('adresse', 'Adresse', { maxLength: 255, placeholder: 'Rue, repère…', autoComplete: 'street-address' })}
      <div className="grid grid-cols-2 gap-3">
        {field('quartier', 'Quartier', { maxLength: 100 })}
        {field('ville', 'Ville', { maxLength: 100, autoComplete: 'address-level2' })}
      </div>
      {withInstructions && (
        <label className="block" htmlFor={`${idPrefix}-instructions`}>
          <span className="text-caption font-medium text-surface-600">Instructions au livreur</span>
          <textarea
            id={`${idPrefix}-instructions`}
            rows={2}
            maxLength={500}
            className="input-field mt-1"
            placeholder="Ex : sonner au portail bleu"
            value={value.instructions ?? ''}
            onChange={set('instructions')}
            disabled={disabled}
          />
        </label>
      )}
      <button
        type="button"
        onClick={locate}
        disabled={loading || disabled}
        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-caption font-medium transition ${
          located ? 'bg-emerald-50 text-emerald-800' : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
        }`}
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : located ? <Check size={15} /> : <LocateFixed size={15} />}
        <span className="flex-1">
          {located ? 'Position GPS enregistrée (aide le livreur à vous trouver)' : 'Utiliser ma position actuelle (recommandé)'}
        </span>
        {located && <MapPin size={14} />}
      </button>
      {error && !located && <p className="text-caption text-amber-700">Position indisponible : {error}</p>}
    </div>
  );
}
