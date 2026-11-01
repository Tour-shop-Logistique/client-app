import { useEffect, useState } from 'react';
import { Bike, Car, Clock3, Loader2, Receipt, Route as RouteIcon, Zap } from 'lucide-react';
import useRoute from '../../hooks/useRoute';
import { isValidPoint, formatDistance, formatEta } from '../../services/routingService';
import LocationPicker from './LocationPicker';
import expeditionService from '../../services/expeditionService';
import agencyService from '../../services/agencyService';
import { estimateMissionFees, expressDisabledInGrid, missionFeeDetail } from '../../utils/pickup';
import { formatPrice } from '../../utils/format';
import FeeBreakdown from './FeeBreakdown';
import { OptionChip, OptionTile } from './OptionCard';

// Champs d'une course du dernier kilomètre (api-enlevement-livraison-client.md) :
//  - `kind = 'enlevement'` : chez l'expéditeur, depuis l'agence de départ ;
//  - `kind = 'livraison'`  : chez le destinataire, depuis l'agence d'arrivée.
// `value` = { mode, vehicule, latitude, longitude, distanceKm, instructions }.
// La distance PAR LA ROUTE agence -> point est calculée côté app (le serveur
// n'en calcule pas). La grille de la commune de l'agence
// (GET grille-tarifs-enlevement) donne les DEUX prix — standard et express
// (= standard × taux express) — affichés avant que le client choisisse
// (user-parcour/CHANGEMENTS_APPS_CLIENT_LIVREUR.md §2).

const MODES = {
  enlevement: [
    { value: 'express', label: 'Express', icon: Zap, tag: 'Rapide', tagTone: 'accent', hint: 'Le premier livreur disponible vient chercher le colis.' },
    { value: 'groupage', label: 'Classique', icon: Clock3, tag: 'Économique', tagTone: 'success', hint: 'TourShop affecte un livreur de l’agence.' },
  ],
  livraison: [
    { value: 'express', label: 'Express', icon: Zap, tag: 'Rapide', tagTone: 'accent', hint: 'Le premier livreur disponible apporte le colis.' },
    { value: 'groupage', label: 'Classique', icon: Clock3, tag: 'Économique', tagTone: 'success', hint: 'TourShop affecte un livreur de l’agence d’arrivée.' },
  ],
};

const VEHICLES = [
  { value: 'moto', label: 'Moto', icon: Bike, hint: 'Petits colis' },
  { value: 'voiture', label: 'Voiture', icon: Car, hint: 'Colis volumineux' },
];

const LABELS = {
  enlevement: { point: 'Point d’enlèvement', agence: 'l’agence', placeholder: 'Ex : sonner au portail bleu, appeler en arrivant' },
  livraison: { point: 'Point de livraison', agence: 'l’agence d’arrivée', placeholder: 'Ex : immeuble gris, 3e étage' },
};

const agencePoint = (agence) => {
  const p = { lat: agence?.latitude, lng: agence?.longitude, nom: agence?.nom_agence };
  return isValidPoint(p) ? { ...p, lat: Number(p.lat), lng: Number(p.lng) } : null;
};

// `currency` : devise des tarifs de la grille (commune de l'agence).
export default function HomeMissionFields({
  value, onChange, agence: agenceProp, communeId: communeIdProp, kind = 'enlevement', currency,
}) {
  const set = (patch) => onChange({ ...value, ...patch });
  const labels = LABELS[kind];

  // L'agence peut venir d'un brouillon ancien (enregistre avant que la liste des
  // agences ne renvoie `commune_id` et la position GPS) : on la recharge alors
  // (GET /agences/{id}) pour retrouver la commune de la grille et le point de depart.
  const [freshAgence, setFreshAgence] = useState(null);
  const [agenceStatus, setAgenceStatus] = useState('idle'); // idle | loading | error
  const incomplete = Boolean(agenceProp?.id) && (!(communeIdProp || agenceProp?.commune_id) || !agencePoint(agenceProp));
  useEffect(() => {
    if (!incomplete) return undefined;
    let alive = true;
    setAgenceStatus('loading');
    agencyService.getById(agenceProp.id)
      .then((r) => { if (alive) { setFreshAgence(r?.agence ?? r?.data ?? null); setAgenceStatus('idle'); } })
      .catch(() => { if (alive) setAgenceStatus('error'); });
    return () => { alive = false; };
  }, [incomplete, agenceProp?.id]);
  const agence = freshAgence && freshAgence.id === agenceProp?.id ? { ...agenceProp, ...freshAgence } : agenceProp;
  const communeId = communeIdProp || agence?.commune_id || null;

  const origin = agencePoint(agence);
  const point = isValidPoint({ lat: value.latitude, lng: value.longitude })
    ? { lat: Number(value.latitude), lng: Number(value.longitude) }
    : null;

  // Itinéraire routier agence -> point, avec le véhicule choisi.
  const { route, status, reload: reloadRoute } = useRoute([origin, point], { enabled: true, vehicle: value.vehicule });

  // Distance retenue pour le tarif : uniquement une vraie distance routière
  // (jamais l'estimation à vol d'oiseau), arrondie à 0,1 km.
  const routeKm = route && !route.approx ? Math.round(route.distanceKm * 10) / 10 : null;
  useEffect(() => {
    if (value.distanceKm !== routeKm) onChange({ ...value, distanceKm: routeKm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKm]);

  // Grille de la commune de l'agence -> prix standard ET express.
  const [grid, setGrid] = useState(null);
  const [gridStatus, setGridStatus] = useState('idle'); // idle | loading | ok | error
  const [gridTick, setGridTick] = useState(0);
  const wantGrid = Boolean(communeId);
  useEffect(() => {
    if (!wantGrid) return undefined;
    let alive = true;
    setGridStatus('loading');
    expeditionService.getPickupTariffGrid(communeId)
      .then((g) => { if (alive) { setGrid(g); setGridStatus('ok'); } })
      .catch(() => { if (alive) { setGrid(null); setGridStatus('error'); } });
    return () => { alive = false; };
  }, [wantGrid, communeId, gridTick]);
  const gridEmpty = wantGrid && Array.isArray(grid?.data) && grid.data.length === 0;
  const fees = wantGrid ? estimateMissionFees(grid, routeKm, value.vehicule) : null;
  // Express indisponible : taux non configuré sur la tranche (ou sur toute la grille).
  const expressOff = (fees && !fees.expressAvailable) || (!fees && expressDisabledInGrid(grid, value.vehicule));
  const feeOf = (mode) => (mode === 'express' ? fees?.express : fees?.standard) ?? null;
  const fee = feeOf(value.mode);
  // Détail du tarif (tranche, standard, majoration express).
  const feeDetail = fee != null
    ? missionFeeDetail({ grid, distanceKm: routeKm, vehicule: value.vehicule, mode: value.mode, total: fee })
    : null;

  // Estimation gardée dans la saisie (`value.estimate`) : le récapitulatif et
  // l'écran de succès de l'expédition affichent ainsi le montant de l'enlèvement.
  const estimateKey = feeDetail ? JSON.stringify(feeDetail) : '';
  useEffect(() => {
    const current = value.estimate ? JSON.stringify(value.estimate) : '';
    // `distanceKm` repris ici : plusieurs effets peuvent partir dans le même
    // rendu, le dernier appel à onChange ne doit pas effacer la distance.
    if (current !== estimateKey) onChange({ ...value, distanceKm: routeKm, estimate: feeDetail });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateKey]);

  // Mode express choisi alors qu'il n'est pas disponible : repli sur le standard.
  useEffect(() => {
    if (expressOff && value.mode === 'express') onChange({ ...value, distanceKm: routeKm, mode: 'groupage' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expressOff]);

  // Etat du calcul du montant : jamais de chargement sans fin, chaque cas dit
  // ce qui se passe (et propose de reessayer quand c'est possible).
  const routeLoading = Boolean(origin && point) && !route && status !== 'error';
  let live;
  if (fee != null) {
    live = { tone: 'ready' };
  } else if (!wantGrid && agenceStatus === 'loading') {
    live = { loading: true, text: 'Recherche de la commune de l’agence…' };
  } else if (!wantGrid) {
    live = { text: 'Aucune commune n’est configurée pour cette agence : le montant sera confirmé par l’agence.' };
  } else if (gridStatus === 'loading' || gridStatus === 'idle') {
    live = { loading: true, text: 'Chargement de la grille tarifaire…' };
  } else if (gridStatus === 'error') {
    live = { error: true, text: 'Grille tarifaire indisponible pour le moment.', retry: () => setGridTick((t) => t + 1) };
  } else if (gridEmpty) {
    live = { text: 'Aucune grille tarifaire configurée pour cette agence : le montant sera confirmé par l’agence.' };
  } else if (!point) {
    live = { text: 'Indiquez le point sur la carte : le montant s’affiche dès que la distance est calculée.' };
  } else if (!origin) {
    live = { text: `${labels.agence.charAt(0).toUpperCase() + labels.agence.slice(1)} n’a pas de position enregistrée : le montant sera confirmé par l’agence.` };
  } else if (routeLoading) {
    live = { loading: true, text: 'Calcul de la distance par la route…' };
  } else if (routeKm == null) {
    live = {
      error: true,
      text: route?.approx
        ? `Itinéraire routier indisponible pour le moment (environ ${formatDistance(route.distanceKm)} à vol d’oiseau). Nouvel essai automatique ; sinon l’agence confirmera le montant.`
        : 'Distance par la route indisponible pour le moment.',
      retry: reloadRoute,
    };
  } else if (fees && !fee) {
    live = { text: 'Ce mode n’est pas disponible pour cette distance : choisissez l’autre mode.' };
  } else {
    live = { text: `Aucune tranche tarifaire pour ${formatDistance(routeKm)} avec ce véhicule : le montant sera confirmé par l’agence.` };
  }

  const eta = route && !route.approx ? formatEta(route.durationMin) : null;
  const sectionTitle = 'mb-1.5 text-xs font-semibold uppercase tracking-wide text-surface-500';

  return (
    <div className="space-y-4">
      {/* 1. Mode : express ou classique, prix côte à côte pour comparer. */}
      <div>
        <p className={sectionTitle}>Mode</p>
        <div className="grid grid-cols-2 gap-2">
          {MODES[kind].map((m) => {
            const off = m.value === 'express' && expressOff;
            const price = feeOf(m.value);
            return (
              <OptionTile
                key={m.value}
                selected={value.mode === m.value}
                onClick={() => set({ mode: m.value })}
                icon={m.icon}
                title={m.label}
                tag={m.tag}
                tagTone={m.tagTone}
                hint={off ? 'Indisponible pour cette distance.' : m.hint}
                price={!off && price != null ? formatPrice(price, currency) : null}
                priceNote={!off && price == null ? 'Selon la distance' : null}
                disabled={off}
              />
            );
          })}
        </div>
      </div>

      {/* 2. Véhicule. */}
      <div>
        <p className={sectionTitle}>Véhicule</p>
        <div className="grid grid-cols-2 gap-2">
          {VEHICLES.map((v) => (
            <OptionChip
              key={v.value}
              selected={value.vehicule === v.value}
              onClick={() => set({ vehicule: v.value })}
              icon={v.icon}
              title={v.label}
              hint={v.hint}
            />
          ))}
        </div>
      </div>

      {/* 3. Point sur la carte. */}
      <LocationPicker
        value={value}
        onChange={(lat, lng) => set({ latitude: lat, longitude: lng })}
        anchor={origin}
        route={route}
        label={labels.point}
        pointLabel={labels.point}
        autoLocate={kind === 'enlevement'}
      />

      {/* 4. Résultat : montant + distance dès qu'ils sont connus, sinon l'étape en cours. */}
      {live.tone === 'ready' ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-2xl bg-primary-600 px-4 py-3 text-white">
            <Receipt size={22} className="shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-primary-100">
                {kind === 'livraison' ? 'Frais de livraison' : 'Frais d’enlèvement'} · {value.mode === 'express' ? 'express' : 'classique'}
              </p>
              <p className="font-heading text-xl font-bold leading-tight">{formatPrice(fee, currency)}</p>
            </div>
            {routeKm != null && (
              <div className="shrink-0 text-right text-xs text-primary-100">
                <p className="flex items-center justify-end gap-1 font-semibold text-white"><RouteIcon size={13} aria-hidden="true" />{formatDistance(routeKm)}</p>
                {eta && <p>≈ {eta}</p>}
              </div>
            )}
          </div>
          <details className="group rounded-xl bg-surface-50 text-xs">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 font-semibold text-primary-700">
              Voir le détail du tarif
              <span className="text-surface-400 transition group-open:rotate-180" aria-hidden="true">⌄</span>
            </summary>
            <div className="px-1 pb-1"><FeeBreakdown detail={feeDetail} currency={currency} /></div>
          </details>
        </div>
      ) : (
        <div
          className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${live.error ? 'bg-amber-50 text-amber-800' : 'bg-surface-50 text-surface-600'}`}
          role="status"
          aria-live="polite"
        >
          {live.loading ? (
            <Loader2 size={14} className="mt-px shrink-0 animate-spin text-primary-600" aria-hidden="true" />
          ) : (
            <RouteIcon size={14} className="mt-px shrink-0 text-primary-600" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1">{live.text}</span>
          {live.retry && (
            <button type="button" onClick={live.retry} className="shrink-0 font-semibold text-primary-700 underline">
              Réessayer
            </button>
          )}
        </div>
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
