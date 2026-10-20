import { formatPrice } from '../../utils/format';

// Détail du tarif d'un enlèvement / d'une livraison à domicile
// (`missionFeeDetail` de utils/pickup.js) : mode, véhicule, distance et tranche,
// tarif standard, majoration express, total.

const VEHICULES = { moto: 'Moto', voiture: 'Voiture' };

const km = (v) => `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;

const trancheLabel = (min, max) => {
  if (min == null) return null;
  return max == null ? `au-delà de ${km(min)}` : `${km(min)} – ${km(max)}`;
};

function Row({ label, value, strong = false }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className={strong ? 'font-semibold text-surface-900' : 'text-surface-500'}>{label}</dt>
      <dd className={`text-right ${strong ? 'font-heading font-bold text-surface-900' : 'font-medium text-surface-800'}`}>{value}</dd>
    </div>
  );
}

export default function FeeBreakdown({ detail, currency, className = '' }) {
  if (!detail) return null;
  const express = detail.mode === 'express';
  const tranche = trancheLabel(detail.kmMin, detail.kmMax);
  const distance = detail.distanceKm != null
    ? `${km(detail.distanceKm)}${tranche ? ` (tranche ${tranche})` : ''}`
    : tranche ? `Tranche ${tranche}` : null;

  return (
    <dl className={`divide-y divide-surface-100 rounded-xl bg-surface-50 px-3 text-xs ${className}`}>
      <Row label="Mode" value={express ? 'Express' : 'Standard'} />
      <Row label="Véhicule" value={VEHICULES[detail.vehicule] ?? detail.vehicule} />
      <Row label="Distance depuis l’agence" value={distance} />
      <Row label="Tarif standard" value={detail.standard != null ? formatPrice(detail.standard, currency) : null} />
      {express && (
        <Row
          label="Majoration express"
          value={detail.taux != null ? `× ${Number(detail.taux).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}` : 'Incluse'}
        />
      )}
      <Row label="Total" value={detail.total != null ? formatPrice(detail.total, currency) : 'Confirmé par l’agence'} strong />
    </dl>
  );
}
