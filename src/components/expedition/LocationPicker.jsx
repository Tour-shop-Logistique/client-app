import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Loader2, LocateFixed } from 'lucide-react';
import useGeolocation from '../../hooks/useGeolocation';
import { isValidPoint } from '../../services/routingService';
import PickupMap from './PickupMap';
import PlaceSearch from './PlaceSearch';

// Point GPS choisi par le client : recherche d'un lieu, « Ma position », tap
// sur la carte ou marqueur déplacé. `value` = { latitude, longitude } ;
// `onChange(lat, lng)`. `anchor` ({ lat, lng, nom }) : agence affichée en repère,
// `route` : itinéraire calculé par le parent. `autoLocate` : demande la
// position GPS au montage si aucun point n'est encore placé.
export default function LocationPicker({
  value, onChange, anchor = null, route = null, label, pointLabel, autoLocate = false,
}) {
  const { position, loading, error, locate } = useGeolocation();
  const countryCode = useSelector((state) => state.country.code);
  const [focusKey, setFocusKey] = useState(0);

  const point = isValidPoint({ lat: value?.latitude, lng: value?.longitude })
    ? { lat: Number(value.latitude), lng: Number(value.longitude) }
    : null;

  // Demande GPS en cours : 'auto' (au montage) ou 'manual' (bouton). Un point
  // placé à la main avant la réponse d'une demande automatique n'est pas écrasé.
  const gpsRequest = useRef(null);
  const requestGps = (kind) => { gpsRequest.current = kind; locate(); };

  useEffect(() => {
    if (autoLocate && !point) requestGps('auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!position || !gpsRequest.current) return;
    gpsRequest.current = null;
    onChange(position.lat, position.lng);
    setFocusKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  const place = (lat, lng, { refocus = false } = {}) => {
    if (gpsRequest.current === 'auto') gpsRequest.current = null;
    onChange(lat, lng);
    if (refocus) setFocusKey((k) => k + 1);
  };

  // Nouveau repère : on recadre la carte.
  useEffect(() => { setFocusKey((k) => k + 1); }, [anchor?.lat, anchor?.lng]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-surface-700">{label}</p>
        <button
          type="button"
          onClick={() => requestGps('manual')}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 disabled:opacity-60"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />} Ma position
        </button>
      </div>
      <PlaceSearch
        countryCode={countryCode}
        near={anchor || point}
        onSelect={(p) => place(p.lat, p.lng, { refocus: true })}
      />
      <PickupMap
        agence={anchor}
        point={point}
        onPlace={(lat, lng) => place(lat, lng)}
        route={route}
        focusKey={focusKey}
        pointLabel={pointLabel}
      />
      {loading && !point && <p className="text-xs text-surface-500">Recherche de votre position…</p>}
      {error && !point && <p className="text-xs text-amber-700">Position indisponible : {error}. Recherchez un lieu ou touchez la carte.</p>}
      {point && (
        <p className="text-xs text-surface-500">Pas le bon endroit ? Déplacez le marqueur vert, touchez la carte ou recherchez un lieu.</p>
      )}
    </div>
  );
}
