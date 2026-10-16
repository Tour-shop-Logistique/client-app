import { useEffect, useState } from 'react';
import { Bike, Car, Check, Route as RouteIcon } from 'lucide-react';
import useRoute from '../../hooks/useRoute';
import { isValidPoint, formatDistance, formatEta } from '../../services/routingService';
import LocationPicker from './LocationPicker';
import expeditionService from '../../services/expeditionService';
import { estimatePickupFee } from '../../utils/pickup';
import { formatPrice } from '../../utils/format';

// Champs d'une course du dernier kilomètre (api-enlevement-livraison-client.md) :
//  - `kind = 'enlevement'` : chez l'expéditeur, depuis l'agence de départ ;
//  - `kind = 'livraison'`  : chez le destinataire, depuis l'agence d'arrivée.
// `value` = { mode, vehicule, latitude, longitude, distanceKm, instructions }.
// La distance PAR LA ROUTE agence -> point est calculée côté app (le serveur
// n'en calcule pas) ; en mode groupage, la grille de la commune de l'agence
// (GET grille-tarifs-enlevement) donne un tarif indicatif avant confirmation.

const MODES = {
  enlevement: [
    { value: 'express', label: 'Récupération express', hint: 'Les livreurs disponibles proposent un prix, vous choisissez.' },
    { value: 'groupage', label: 'Retrait classique', hint: 'Tarif fixe selon la distance par la route depuis l’agence.' },
  ],
  livraison: [
    { value: 'express', label: 'Livraison express', hint: 'Les livreurs disponibles proposent un prix, vous choisissez.' },
    { value: 'groupage', label: 'Livraison classique', hint: 'Tarif fixe selon la distance par la route depuis l’agence d’arrivée.' },
  ],
};

const VEHICLES = [
  { value: 'moto', label: 'Moto', icon: Bike },
  { value: 'voiture', label: 'Voiture', icon: Car },
];

const LABELS = {
  enlevement: { point: 'Point d’enlèvement', agence: 'l’agence', placeholder: 'Ex : sonner au portail bleu, appeler en arrivant' },
  livraison: { point: 'Point de livraison', agence: 'l’agence d’arrivée', placeholder: 'Ex : immeuble gris, 3e étage' },
};

const agencePoint = (agence) => {
  const p = { lat: agence?.latitude, lng: agence?.longitude, nom: agence?.nom_agence };
  return isValidPoint(p) ? { ...p, lat: Number(p.lat), lng: Number(p.lng) } : null;
};

export function Choice({ selected, onClick, icon: Icon, title, hint }) {
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

export default function HomeMissionFields({ value, onChange, agence, communeId, kind = 'enlevement' }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const labels = LABELS[kind];

  const origin = agencePoint(agence);
  const point = isValidPoint({ lat: value.latitude, lng: value.longitude })
    ? { lat: Number(value.latitude), lng: Number(value.longitude) }
    : null;

  // Itinéraire routier agence -> point, avec le véhicule choisi.
  const { route, status } = useRoute([origin, point], { enabled: true, vehicle: value.vehicule });

  // Distance retenue pour le tarif : uniquement une vraie distance routière
  // (jamais l'estimation à vol d'oiseau), arrondie à 0,1 km.
  const routeKm = route && !route.approx ? Math.round(route.distanceKm * 10) / 10 : null;
  useEffect(() => {
    if (value.distanceKm !== routeKm) onChange({ ...value, distanceKm: routeKm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKm]);

  // Grille de la commune de l'agence (mode groupage) -> tarif indicatif.
  const [grid, setGrid] = useState(null);
  const wantGrid = value.mode === 'groupage' && Boolean(communeId);
  useEffect(() => {
    if (!wantGrid) return undefined;
    let alive = true;
    expeditionService.getPickupTariffGrid(communeId)
      .then((g) => { if (alive) setGrid(g); })
      .catch(() => { if (alive) setGrid(null); });
    return () => { alive = false; };
  }, [wantGrid, communeId]);
  const gridEmpty = wantGrid && Array.isArray(grid?.data) && grid.data.length === 0;
  const fee = wantGrid ? estimatePickupFee(grid, routeKm, value.vehicule) : null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {MODES[kind].map((m) => (
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

      <LocationPicker
        value={value}
        onChange={(lat, lng) => set({ latitude: lat, longitude: lng })}
        anchor={origin}
        route={route}
        label={labels.point}
        pointLabel={labels.point}
        autoLocate={kind === 'enlevement'}
      />

      <div className="flex items-start gap-2 rounded-xl bg-surface-50 px-3 py-2.5 text-xs text-surface-600">
        <RouteIcon size={15} className="mt-px shrink-0 text-primary-600" />
        {!point ? (
          <span>Recherchez un lieu, touchez la carte à l’endroit où le livreur doit se rendre, ou utilisez votre position.</span>
        ) : !origin ? (
          <span>{labels.agence.charAt(0).toUpperCase() + labels.agence.slice(1)} n’a pas de position enregistrée : la distance sera confirmée par l’agence.</span>
        ) : status === 'loading' && !route ? (
          <span>Calcul de la distance par la route…</span>
        ) : route && !route.approx ? (
          <span>
            Distance par la route depuis {labels.agence} : <strong className="text-surface-900">{formatDistance(route.distanceKm)}</strong>
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
          <span className="text-surface-600">Tarif estimé</span>
          <strong className="text-primary-800">{formatPrice(fee)}</strong>
        </div>
      )}
      {gridEmpty && (
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          Aucune grille tarifaire n’est configurée pour cette agence : choisissez plutôt le mode express.
        </p>
      )}

      <label className="block text-sm font-medium text-surface-700">
        Instructions au livreur (optionnel)
        <textarea
          rows={2}
          maxLength={500}
          className="input-field mt-1.5"
          placeholder={labels.placeholder}
          value={value.instructions}
          onChange={(e) => set({ instructions: e.target.value })}
        />
      </label>
    </div>
  );
}
