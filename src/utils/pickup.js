// Enlèvement à domicile choisi dès l'enregistrement (POST /expedition/client/store,
// modes `interville` et `livraison_domicile` uniquement) —
// REPONSE_AUDIT_CAHIER_DES_CHARGES_CLIENT (1).md §6.
//   - groupage : la demande part au backoffice, qui assigne un livreur rattaché
//                (tarif fixe par tranche de km) ;
//   - express  : diffusée aux livreurs indépendants, qui proposent un prix à
//                accepter ensuite depuis le détail de l'expédition.

export const EMPTY_PICKUP = {
  domicile: false,
  mode: 'express',
  vehicule: 'moto',
  latitude: null,
  longitude: null,
  distanceKm: null,
  instructions: '',
};

export const PICKUP_MODE_MESSAGE = {
  groupage: 'Retrait classique : demande transmise, TourShop vous affecte un livreur.',
  express: 'Récupération express : demande diffusée aux livreurs, les offres de prix arrivent dans le détail de l’expédition.',
};

// Tarif d'enlèvement groupage estimé depuis la grille de l'agence
// (GET /expedition/client/grille-tarifs-enlevement) pour une distance routière
// et un véhicule. Le format exact de la grille n'est pas documenté côté app :
// lecture défensive (tableau direct, ou sous `data` / `grille` / `tranches`, ou
// regroupé par véhicule), null si aucune tranche ne correspond.
const firstNum = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
};

const gridRows = (grid) => {
  const root = grid?.data ?? grid?.grille ?? grid?.tranches ?? grid;
  if (Array.isArray(root)) return root;
  if (root && typeof root === 'object') {
    // { moto: [...], voiture: [...] }
    return Object.entries(root).flatMap(([vehicule, rows]) => (Array.isArray(rows)
      ? rows.map((r) => ({ type_vehicule: vehicule, ...r }))
      : []));
  }
  return [];
};

export function estimatePickupFee(grid, distanceKm, vehicule) {
  if (distanceKm == null) return null;
  const rows = gridRows(grid).filter((r) => {
    const v = r.type_vehicule ?? r.vehicule;
    return !v || !vehicule || v === vehicule;
  });
  const row = rows.find((r) => {
    const min = firstNum(r, ['km_min', 'distance_min', 'min_km', 'tranche_min', 'de', 'min']) ?? 0;
    const max = firstNum(r, ['km_max', 'distance_max', 'max_km', 'tranche_max', 'a', 'max']);
    return distanceKm >= min && (max == null || distanceKm <= max);
  });
  return row ? firstNum(row, ['montant', 'tarif', 'prix', 'montant_fixe']) : null;
}

// Champs à ajouter au corps de `store` ({} si le client dépose lui-même).
// `enlevement_distance_km` : distance PAR LA ROUTE agence -> point d'enlèvement,
// calculée sur la carte (services/routingService.js). Absente si aucun moteur
// routier n'a répondu ou si l'agence n'a pas de coordonnées : le backoffice
// confirme alors le montant à l'assignation.
// `expediteur_latitude/longitude` et `instructions_enlevement` sont lus par
// l'app livreur (PARCOURS_LIVREUR_API.md §4.2) mais pas encore documentés en
// entrée de `store` : à confirmer avec le backend.
export function pickupPayload(pickup) {
  if (!pickup?.domicile) return {};
  const out = {
    enlevement_domicile: true,
    enlevement_mode: pickup.mode,
    enlevement_type_vehicule: pickup.vehicule,
  };
  if (pickup.distanceKm != null) out.enlevement_distance_km = pickup.distanceKm;
  if (pickup.latitude != null && pickup.longitude != null) {
    out.expediteur_latitude = pickup.latitude;
    out.expediteur_longitude = pickup.longitude;
  }
  const instructions = (pickup.instructions || '').trim();
  if (instructions) out.instructions_enlevement = instructions;
  return out;
}
