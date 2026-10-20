import { useState } from 'react';
import { useSelector } from 'react-redux';
import { BookMarked, MapPin, User } from 'lucide-react';
import LocationPicker from './LocationPicker';
import { applyFavorite, whatsappInvalid } from '../../utils/contact';
import { digitsOnly, digitsInputProps } from '../../utils/digits';

// Shared expediteur/destinataire block for the expedition forms.
// Shape + helpers (EMPTY_CONTACT, contactIsComplete, contactPayload) live in
// src/utils/contact.js.
//
// The ville field: pass `villeFixed` to lock it to the commune already chosen
// during the trajet step, `communes` to offer a select of the country's
// communes, or neither for free text.
// `children` : bloc complémentaire affiché sous l'adresse (ex. pièce d'identité).
// `withLocation` : position GPS + instructions pour le livreur (optionnelles,
// `{prefix}_latitude/longitude/instructions`), utiles pour une livraison ou un
// enlèvement à domicile.
// Les adresses favorites du profil (`user.adresses_favoris`) préremplissent
// adresse, ville et code postal.
export default function ContactFields({
  title, data, onChange, communes, villeFixed, withLocation = false, locationLabel = 'Position pour le livreur', children,
}) {
  const [showMore, setShowMore] = useState(false);
  const [showLocation, setShowLocation] = useState(data.latitude != null || Boolean(data.instructions));
  const favorites = useSelector((state) => state.auth.user?.adresses_favoris);
  const set = (field) => (e) => onChange({ ...data, [field]: e.target.value });

  const favoriteList = Array.isArray(favorites) ? favorites.filter((f) => f?.adresse) : [];
  const pickFavorite = (e) => {
    const fav = favoriteList[Number(e.target.value)];
    if (!fav) return;
    // Une ville imposée (commune du trajet) ou hors liste des communes n'est pas recopiée.
    const keepVille = Boolean(villeFixed) || (communes && !communes.some((c) => c.nom === fav.ville));
    onChange(applyFavorite(data, fav, { keepVille }));
  };

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <User size={18} className="text-primary-600" />
        <p className="font-semibold text-surface-900">{title}</p>
      </div>
      {favoriteList.length > 0 && (
        <label className="block text-sm font-medium text-surface-700">
          <span className="flex items-center gap-1.5"><BookMarked size={14} className="text-primary-600" /> Adresse favorite</span>
          <select className="input-field mt-1.5" value="" onChange={pickFavorite}>
            <option value="">Préremplir depuis mes adresses…</option>
            {favoriteList.map((f, i) => (
              <option key={`${f.nom}-${i}`} value={i}>
                {[f.nom, f.adresse, f.ville].filter(Boolean).join(' · ')}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm font-medium text-surface-700">
        Nom et prénom
        <input className="input-field mt-1.5" placeholder="Ex: Jean Kouassi" value={data.nom_prenom} onChange={set('nom_prenom')} />
      </label>
      <label className="block text-sm font-medium text-surface-700">
        Téléphone
        <input
          className="input-field mt-1.5"
          {...digitsInputProps}
          placeholder="Ex: 0102030405"
          value={digitsOnly(data.telephone)}
          onChange={(e) => onChange({ ...data, telephone: digitsOnly(e.target.value) })}
        />
      </label>
      <label className="block text-sm font-medium text-surface-700">
        Adresse
        <input className="input-field mt-1.5" placeholder="Ex: Rue 12" value={data.adresse} onChange={set('adresse')} />
      </label>
      <div className="block text-sm font-medium text-surface-700">
        Ville
        {villeFixed ? (
          <div className="input-field mt-1.5 bg-surface-50 text-surface-500">{villeFixed}</div>
        ) : communes ? (
          <select className="input-field mt-1.5" value={data.ville} onChange={set('ville')}>
            <option value="">Choisir une commune</option>
            {communes.map((c) => (
              <option key={c.id} value={c.nom}>
                {c.nom}
              </option>
            ))}
          </select>
        ) : (
          <input className="input-field mt-1.5" placeholder="Ex: Bouake" value={data.ville} onChange={set('ville')} />
        )}
      </div>
      {children}

      {withLocation && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowLocation((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600"
          >
            <MapPin size={13} />
            {showLocation ? 'Masquer la position pour le livreur' : '+ Position et instructions pour le livreur (recommandé)'}
          </button>
          {showLocation && (
            <div className="space-y-3 border-t border-surface-100 pt-3">
              <LocationPicker
                value={data}
                onChange={(lat, lng) => onChange({ ...data, latitude: lat, longitude: lng })}
                label={locationLabel}
                pointLabel={title}
              />
              {data.latitude != null && (
                <button
                  type="button"
                  className="text-xs font-medium text-surface-500"
                  onClick={() => onChange({ ...data, latitude: null, longitude: null })}
                >
                  Retirer la position
                </button>
              )}
              <label className="block text-sm font-medium text-surface-700">
                Instructions au livreur (optionnel)
                <textarea
                  rows={2}
                  maxLength={500}
                  className="input-field mt-1.5"
                  placeholder="Ex : immeuble gris, 3e étage, appeler en arrivant"
                  value={data.instructions || ''}
                  onChange={set('instructions')}
                />
              </label>
            </div>
          )}
        </div>
      )}

      <button type="button" onClick={() => setShowMore((v) => !v)} className="text-xs font-semibold text-primary-600">
        {showMore ? 'Masquer les champs optionnels' : '+ WhatsApp, e-mail, société, code postal…'}
      </button>
      {showMore && (
        <div className="space-y-3 border-t border-surface-100 pt-3">
          <label className="block text-sm font-medium text-surface-700">
            WhatsApp (optionnel)
            {/* Chiffres uniquement : le « + » est ajouté automatiquement à l'envoi. */}
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-surface-500" aria-hidden="true">+</span>
              <input
                className="input-field pl-8"
                {...digitsInputProps}
                autoComplete="off"
                placeholder="2250102030405"
                value={digitsOnly(data.whatsapp)}
                onChange={(e) => onChange({ ...data, whatsapp: digitsOnly(e.target.value) })}
              />
            </div>
            {whatsappInvalid(data) ? (
              <span className="mt-1 block text-xs text-red-600">Indicatif du pays + numéro, chiffres uniquement (ex : 2250102030405).</span>
            ) : (
              <span className="mt-1 block text-xs font-normal text-surface-400">Pour recevoir aussi les notifications de l’expédition sur WhatsApp.</span>
            )}
          </label>
          <label className="block text-sm font-medium text-surface-700">
            Email (optionnel)
            <input type="email" className="input-field mt-1.5" value={data.email} onChange={set('email')} />
          </label>
          <label className="block text-sm font-medium text-surface-700">
            Société (optionnel)
            <input className="input-field mt-1.5" value={data.societe} onChange={set('societe')} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-surface-600">
              Code postal
              <input className="input-field mt-1.5" value={data.code_postal} onChange={set('code_postal')} />
            </label>
            <label className="block text-xs font-medium text-surface-600">
              État / Région
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
