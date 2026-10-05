import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Bike, Building2, Car, Check, Loader2, LocateFixed, Route as RouteIcon, Truck,
} from 'lucide-react';
import useGeolocation from '../../hooks/useGeolocation';
import useRoute from '../../hooks/useRoute';
import { isValidPoint, formatDistance, formatEta } from '../../services/routingService';
import PickupMap from './PickupMap';
import PlaceSearch from './PlaceSearch';
import expeditionService from '../../services/expeditionService';
import { estimatePickupFee } from '../../utils/pickup';
import { formatPrice } from '../../utils/format';

// Remise du colis : dépôt en agence (par défaut) ou enlèvement à domicile.
// Le point d'enlèvement part de la position GPS du client (demandée dès que
// l'enlèvement est choisi) ; il peut le modifier (tap, glisser le marqueur,
// recherche d'un lieu) ; la distance PAR LA ROUTE depuis l'agence de départ est
// calculée et envoyée en `enlevement_distance_km`. Valeur et payload :
// src/utils/pickup.js.

const MODES = [
  {
    value: 'express',
    label: 'Récupération express',
    hint: 'Les livreurs disponibles proposent un prix, vous choisissez.',
  },
  {
    value: 'groupage',
    label: 'Retrait classique',
    hint: 'Tarif fixe selon la distance par la route depuis l’agence.',
  },
];

const VEHICLES = [
  { value: 'moto', label: 'Moto', icon: Bike },
  { value: 'voiture', label: 'Voiture', icon: Car },
];

const agencePoint = (agence) => {
  const p = { lat: agence?.latitude, lng: agence?.longitude, nom: agence?.nom_agence };
  return isValidPoint(p) ? { ...p, lat: Number(p.lat), lng: Number(p.lng) } : null;
};

function Choice({ selected, onClick, icon: Icon, title, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
        selected ? 'border-primary-600 bg-primary-50' : 'border-surface-200 bg-white'
      }`}
    >
      {Icon && (
        <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-white text-primary-600' : 'bg-surface-100 text-surface-500'}`}>
          <Icon size={16} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-surface-900">{title}</span>
        {hint && <span className="block text-xs text-surface-500">{hint}</span>}
      </span>
      {selected && <Check size={16} className="mt-1 shrink-0 text-primary-600" />}
    </button>
  );
}

export default function PickupOption({ value, onChange, address, agence, communeId }) {
  const { position, loading, error, locate } = useGeolocation();
  const countryCode = useSelector((state) => state.country.code);
  const set = (patch) => onChange({ ...value, ...patch });
  const [focusKey, setFocusKey] = useState(0);

  const origin = agencePoint(agence);
  const point = isValidPoint({ lat: value.latitude, lng: value.longitude })
    ? { lat: Number(value.latitude), lng: Number(value.longitude) }
    : null;

  // Demande GPS en cours : 'auto' (à l'ouverture) ou 'manual' (bouton).
  // Si le client place le point lui-même avant la réponse d'une demande
  // automatique, celle-ci ne doit pas écraser son choix.
  const gpsRequest = useRef(null);
  const requestGps = (kind) => { gpsRequest.current = kind; locate(); };

  // Enlèvement à domicile choisi sans point : on part de la position du client.
  useEffect(() => {
    if (value.domicile && !point) requestGps('auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.domicile]);

  // Position GPS obtenue : elle devient le point d'enlèvement.
  useEffect(() => {
    if (!position || !gpsRequest.current) return;
    gpsRequest.current = null;
    onChange({ ...value, latitude: position.lat, longitude: position.lng });
    setFocusKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  // Point placé à la main (tap, glisser) ou via la recherche.
  const placePoint = (lat, lng, { refocus = false } = {}) => {
    if (gpsRequest.current === 'auto') gpsRequest.current = null;
    set({ latitude: lat, longitude: lng });
    if (refocus) setFocusKey((k) => k + 1);
  };

  // Nouvelle agence : on recadre la carte.
  useEffect(() => { setFocusKey((k) => k + 1); }, [origin?.lat, origin?.lng]);

  // Itinéraire routier agence -> point d'enlèvement, avec le véhicule choisi.
  const { route, status } = useRoute([origin, point], { enabled: value.domicile, vehicle: value.vehicule });

  // Distance retenue pour le tarif : uniquement une vraie distance routière
  // (jamais l'estimation à vol d'oiseau), arrondie à 0,1 km.
  const routeKm = route && !route.approx ? Math.round(route.distanceKm * 10) / 10 : null;
  useEffect(() => {
    if (value.distanceKm !== routeKm) onChange({ ...value, distanceKm: routeKm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKm]);

  // Grille de l'agence (mode groupage) -> tarif estimé pour la distance routière.
  const [grid, setGrid] = useState(null);
  const wantGrid = value.domicile && value.mode === 'groupage' && Boolean(communeId);
  useEffect(() => {
    if (!wantGrid) return undefined;
    let alive = true;
    expeditionService.getPickupTariffGrid(communeId)
      .then((g) => { if (alive) setGrid(g); })
      .catch(() => { if (alive) setGrid(null); });
    return () => { alive = false; };
  }, [wantGrid, communeId]);
  const fee = wantGrid ? estimatePickupFee(grid, routeKm, value.vehicule) : null;

  return (
    <div className="card space-y-3 p-4">
      <p className="font-semibold text-surface-900">Remise du colis</p>

      <div className="space-y-2">
        <Choice
          selected={!value.domicile}
          onClick={() => set({ domicile: false })}
          icon={Building2}
          title="Je dépose le colis à l’agence"
        />
        <Choice
          selected={value.domicile}
          onClick={() => set({ domicile: true })}
          icon={Truck}
          title="Un livreur vient le chercher"
          hint={address ? `À l’adresse de l’expéditeur : ${address}` : 'À l’adresse de l’expéditeur'}
        />
      </div>

      {value.domicile && (
        <div className="space-y-3 border-t border-surface-100 pt-3">
          <div className="space-y-2">
            {MODES.map((m) => (
              <Choice key={m.value} selected={value.mode === m.value} onClick={() => set({ mode: m.value })} title={m.label} hint={m.hint} />
            ))}
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-surface-700">Véhicule adapté au colis</p>
            <div className="grid grid-cols-2 gap-2">
              {VEHICLES.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => set({ vehicule: v.value })}
                  aria-pressed={value.vehicule === v.value}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-semibold transition ${
                    value.vehicule === v.value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-surface-200 text-surface-600'
                  }`}
                >
                  <v.icon size={16} /> {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-surface-700">Point d’enlèvement</p>
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
              near={origin || point}
              onSelect={(p) => placePoint(p.lat, p.lng, { refocus: true })}
            />
            <PickupMap
              agence={origin}
              point={point}
              onPlace={(lat, lng) => placePoint(lat, lng)}
              route={route}
              focusKey={focusKey}
            />
            {loading && !point && <p className="text-xs text-surface-500">Recherche de votre position…</p>}
            {error && !point && <p className="text-xs text-amber-700">Position indisponible : {error}. Recherchez un lieu ou touchez la carte.</p>}
            {point && (
              <p className="text-xs text-surface-500">Pas le bon endroit ? Déplacez le marqueur vert, touchez la carte ou recherchez un lieu.</p>
            )}

            <div className="flex items-start gap-2 rounded-xl bg-surface-50 px-3 py-2.5 text-xs text-surface-600">
              <RouteIcon size={15} className="mt-px shrink-0 text-primary-600" />
              {!point ? (
                <span>Recherchez un lieu, touchez la carte à l’endroit où le livreur doit récupérer le colis, ou utilisez votre position.</span>
              ) : !origin ? (
                <span>Cette agence n’a pas de position enregistrée : la distance sera confirmée par l’agence.</span>
              ) : status === 'loading' && !route ? (
                <span>Calcul de la distance par la route…</span>
              ) : route && !route.approx ? (
                <span>
                  Distance par la route depuis l’agence : <strong className="text-surface-900">{formatDistance(route.distanceKm)}</strong>
                  {formatEta(route.durationMin) && <> · environ {formatEta(route.durationMin)}</>}
                </span>
              ) : route?.approx ? (
                <span>
                  Itinéraire routier indisponible pour le moment (environ {formatDistance(route.distanceKm)} à vol d’oiseau). Nouvel essai automatique ; sinon l’agence confirmera la distance.
                </span>
              ) : (
                <span>Distance indisponible : l’agence la confirmera.</span>
              )}
            </div>
            {fee != null && (
              <div className="flex items-center justify-between rounded-xl border border-primary-100 bg-primary-50/60 px-3 py-2.5 text-sm">
                <span className="text-surface-600">Tarif estimé de l’enlèvement</span>
                <strong className="text-primary-800">{formatPrice(fee)}</strong>
              </div>
            )}
          </div>

          <label className="block text-sm font-medium text-surface-700">
            Instructions au livreur (optionnel)
            <textarea
              rows={2}
              maxLength={500}
              className="input-field mt-1.5"
              placeholder="Ex : sonner au portail bleu, appeler en arrivant"
              value={value.instructions}
              onChange={(e) => set({ instructions: e.target.value })}
            />
          </label>

          <p className="text-xs text-surface-500">
            Le tarif de l’enlèvement est fixé à part : offres des livreurs en récupération express, ou grille de l’agence selon la distance en retrait classique.
          </p>
        </div>
      )}
    </div>
  );
}
