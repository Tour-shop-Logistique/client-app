// Enlèvement à domicile choisi dès l'enregistrement (POST /expedition/client/store,
// modes `interville` et `livraison_domicile` uniquement) —
// REPONSE_AUDIT_CAHIER_DES_CHARGES_CLIENT (1).md §6.
//   - groupage : la demande part au backoffice, qui assigne un livreur rattaché
//                (tarif fixe par tranche de km) ;
//   - express  : prix imposé = montant standard × taux express, calculé par le
//                backend ; course diffusée aux livreurs, le premier qui accepte
//                la prend (plus d'offres à comparer —
//                user-parcour/CHANGEMENTS_APPS_CLIENT_LIVREUR.md §2).

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
  express: 'Récupération express : prix fixe, la course est proposée aux livreurs disponibles et le premier qui l’accepte vient chercher le colis.',
};

// Tarifs estimés depuis la grille de l'agence
// (GET /expedition/client/grille-tarifs-enlevement) pour une distance routière
// et un véhicule. Tranche : { type_vehicule, km_min, km_max (null = illimitée),
// montant_standard, taux_express (null = express indisponible), montant_express }.
// `montant` (ancien nom de `montant_standard`) reste lu en repli. Lecture
// défensive (tableau direct, ou sous `data` / `grille` / `tranches`, ou
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

const findRow = (grid, distanceKm, vehicule) => {
  if (distanceKm == null) return null;
  const rows = gridRows(grid).filter((r) => {
    const v = r.type_vehicule ?? r.vehicule;
    return !v || !vehicule || v === vehicule;
  });
  return rows.find((r) => {
    const min = firstNum(r, ['km_min', 'distance_min', 'min_km', 'tranche_min', 'de', 'min']) ?? 0;
    const max = firstNum(r, ['km_max', 'distance_max', 'max_km', 'tranche_max', 'a', 'max']);
    return distanceKm >= min && (max == null || distanceKm <= max);
  }) ?? null;
};

// { standard, express, expressAvailable } pour la tranche couvrant la distance,
// ou null si aucune tranche. `express` = montant_express, sinon standard × taux.
export function estimateMissionFees(grid, distanceKm, vehicule) {
  const row = findRow(grid, distanceKm, vehicule);
  if (!row) return null;
  const standard = firstNum(row, ['montant_standard', 'montant', 'tarif', 'prix', 'montant_fixe']);
  const taux = firstNum(row, ['taux_express']);
  const express = firstNum(row, ['montant_express']) ?? (standard != null && taux != null ? Math.round(standard * taux) : null);
  return { standard, express, expressAvailable: express != null };
}

// Détail du tarif d'une course (enlèvement ou livraison à domicile), pour
// l'afficher au client : tranche de distance appliquée, tarif standard et,
// en express, la majoration. `total` : montant connu côté serveur s'il est
// fourni (il fait foi), sinon celui calculé depuis la grille.
// -> { mode, vehicule, distanceKm, kmMin, kmMax, standard, taux, total } | null
export function missionFeeDetail({
  grid, distanceKm, vehicule, mode, total = null,
}) {
  const row = findRow(grid, distanceKm, vehicule);
  const standard = row ? firstNum(row, ['montant_standard', 'montant', 'tarif', 'prix', 'montant_fixe']) : null;
  const taux = row && mode === 'express' ? firstNum(row, ['taux_express']) : null;
  const computed = mode === 'express'
    ? (row ? firstNum(row, ['montant_express']) ?? (standard != null && taux != null ? Math.round(standard * taux) : null) : null)
    : standard;
  if (!row && total == null) return null;
  return {
    mode: mode === 'express' ? 'express' : 'groupage',
    vehicule: vehicule ?? row?.type_vehicule ?? null,
    distanceKm: distanceKm ?? null,
    kmMin: row ? firstNum(row, ['km_min', 'distance_min', 'min_km', 'tranche_min', 'de', 'min']) ?? 0 : null,
    kmMax: row ? firstNum(row, ['km_max', 'distance_max', 'max_km', 'tranche_max', 'a', 'max']) : null,
    standard,
    taux,
    total: total ?? computed,
  };
}

// Tarif d'un mode donné ('groupage' = standard | 'express').
export function estimatePickupFee(grid, distanceKm, vehicule, mode = 'groupage') {
  const fees = estimateMissionFees(grid, distanceKm, vehicule);
  if (!fees) return null;
  return mode === 'express' ? fees.express : fees.standard;
}

// La grille signale-t-elle l'express comme indisponible pour TOUTES les
// tranches du véhicule (taux_express null partout) ?
export function expressDisabledInGrid(grid, vehicule) {
  const rows = gridRows(grid).filter((r) => !vehicule || !(r.type_vehicule ?? r.vehicule) || (r.type_vehicule ?? r.vehicule) === vehicule);
  return rows.length > 0 && rows.every((r) => r.taux_express === null && r.montant_express == null);
}

// Champs à ajouter au corps de `store` ({} si le client dépose lui-même).
// `enlevement_distance_km` : distance PAR LA ROUTE agence -> point d'enlèvement,
// calculée sur la carte (services/routingService.js). Absente si aucun moteur
// routier n'a répondu ou si l'agence n'a pas de coordonnées : le backoffice
// confirme alors le montant à l'assignation.
// Point et instructions : `expediteur_latitude/longitude/instructions` en
// entrée de `store` (api-enregistrement-expedition-client.md), stockés par le
// serveur sur `expediteur_latitude/longitude` et `instructions_enlevement`.
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
  if (instructions) out.expediteur_instructions = instructions;
  return out;
}

// Corps de POST /expedition/client/{id}/demander-enlevement | demander-livraison
// (api-enlevement-livraison-client.md) : { mode, distance_km?, type_vehicule?,
// latitude?, longitude?, instructions? }. Le mode n'est plus modifiable ensuite.
export function missionRequestPayload(value) {
  const out = { mode: value.mode, type_vehicule: value.vehicule };
  if (value.distanceKm != null) out.distance_km = value.distanceKm;
  if (value.latitude != null && value.longitude != null) {
    out.latitude = value.latitude;
    out.longitude = value.longitude;
  }
  const instructions = (value.instructions || '').trim();
  if (instructions) out.instructions = instructions;
  return out;
}
