import { useEffect } from 'react';
import { LocateFixed, Loader2, MapPin, Check } from 'lucide-react';
import useGeolocation from '../../hooks/useGeolocation';
import useCommunes from '../../hooks/useCommunes';

// Helpers associes (EMPTY_ADDRESS, toRetraitPayload, retraitErrors…) : utils/marketplace.js.

// Champs d'adresse partages (retrait vendeur / livraison acheteur).
// `value` : { nom, telephone, adresse, ville, latitude, longitude, instructions? }
// La ville se choisit parmi les communes du pays (backoffice) ; plus de quartier :
// `adresse` sert de description libre du lieu. Saisie libre de la ville seulement
// si la liste ne peut pas etre chargee.
// `required` : liste des champs obligatoires (marques d'un *), `gps` compris.
// `errors` : { [champ]: message }, `gps` pour la position.

export default function AddressFields({
  value, onChange, required = [], withInstructions = false, errors = {}, disabled = false, idPrefix = 'addr',
}) {
  const { position, loading, error, locate } = useGeolocation();
  const { communes, status } = useCommunes();
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });

  useEffect(() => {
    if (position) onChange({ ...value, latitude: position.lat, longitude: position.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  const label = (key, text) => (
    <span className="text-caption font-medium text-surface-600">
      {text}
      {required.includes(key) && <span className="text-red-600"> *</span>}
    </span>
  );
  const errorText = (key) => errors[key] && <span className="mt-1 block text-caption text-red-600">{errors[key]}</span>;
  const errorBorder = (key) => (errors[key] ? 'border-red-400' : '');

  const field = (key, text, props = {}) => (
    <label className="block" htmlFor={`${idPrefix}-${key}`}>
      {label(key, text)}
      <input
        id={`${idPrefix}-${key}`}
        className={`input-field mt-1 ${errorBorder(key)}`}
        value={value[key] ?? ''}
        onChange={set(key)}
        disabled={disabled}
        {...props}
      />
      {errorText(key)}
    </label>
  );

  // Ville deja saisie (ancienne adresse) absente de la liste : on la garde selectionnable.
  const villeOptions = value.ville && !communes.some((c) => c.nom === value.ville)
    ? [{ id: `current-${value.ville}`, nom: value.ville }, ...communes]
    : communes;
  const freeVille = status === 'error' || status === 'none' || (status === 'idle' && communes.length === 0);

  const located = value.latitude != null && value.longitude != null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {field('nom', 'Nom du contact', { maxLength: 255, autoComplete: 'name' })}
        {field('telephone', 'Téléphone', { maxLength: 20, inputMode: 'tel', autoComplete: 'tel' })}
      </div>

      <label className="block" htmlFor={`${idPrefix}-ville`}>
        {label('ville', 'Ville')}
        {freeVille ? (
          <input
            id={`${idPrefix}-ville`}
            className={`input-field mt-1 ${errorBorder('ville')}`}
            value={value.ville ?? ''}
            onChange={set('ville')}
            disabled={disabled}
            maxLength={100}
            autoComplete="address-level2"
          />
        ) : (
          <select
            id={`${idPrefix}-ville`}
            className={`input-field mt-1 ${errorBorder('ville')}`}
            value={value.ville ?? ''}
            onChange={set('ville')}
            disabled={disabled || status === 'loading'}
          >
            <option value="">{status === 'loading' ? 'Chargement des villes…' : 'Choisir une ville'}</option>
            {villeOptions.map((c) => (
              <option key={c.id} value={c.nom}>
                {c.nom}
              </option>
            ))}
          </select>
        )}
        {errorText('ville')}
      </label>

      <label className="block" htmlFor={`${idPrefix}-adresse`}>
        {label('adresse', 'Adresse / description du lieu')}
        <textarea
          id={`${idPrefix}-adresse`}
          rows={2}
          maxLength={255}
          className={`input-field mt-1 ${errorBorder('adresse')}`}
          placeholder="Ex : Cocody Angré 8e tranche, derrière la pharmacie, portail bleu"
          value={value.adresse ?? ''}
          onChange={set('adresse')}
          disabled={disabled}
          autoComplete="street-address"
        />
        {errorText('adresse')}
      </label>

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

      <div>
        <button
          type="button"
          onClick={locate}
          disabled={loading || disabled}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-caption font-medium transition ${
            located
              ? 'bg-emerald-50 text-emerald-800'
              : errors.gps
                ? 'bg-red-50 text-red-700 ring-1 ring-red-300'
                : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
          }`}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : located ? <Check size={15} /> : <LocateFixed size={15} />}
          <span className="flex-1">
            {located
              ? 'Position GPS enregistrée (aide le livreur à vous trouver)'
              : required.includes('gps')
                ? 'Enregistrer ma position actuelle'
                : 'Utiliser ma position actuelle (recommandé)'}
            {!located && required.includes('gps') && <span className="text-red-600"> *</span>}
          </span>
          {located && <MapPin size={14} />}
        </button>
        {errorText('gps')}
        {error && !located && <p className="mt-1 text-caption text-amber-700">Position indisponible : {error}</p>}
      </div>
    </div>
  );
}
