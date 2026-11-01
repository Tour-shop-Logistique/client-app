import { Building2, Loader2, Receipt, Truck } from 'lucide-react';
import HomeMissionFields, { Choice } from './HomeMissionFields';
import { formatPrice } from '../../utils/format';
import { formatDistance } from '../../services/routingService';

// Remise du colis : dépôt en agence (par défaut) ou enlèvement à domicile.
// Le point d'enlèvement part de la position GPS du client (demandée dès que
// l'enlèvement est choisi) ; la distance PAR LA ROUTE depuis l'agence de départ
// est envoyée en `enlevement_distance_km`. Champs : HomeMissionFields ;
// valeur et payload : src/utils/pickup.js.

// Montant de l'enlèvement affiché dès qu'il est calculé (distance par la route
// connue + grille de l'agence), sans attendre le récapitulatif. Avant cela, il
// dit ce qu'il manque pour l'obtenir.
function LiveFee({ value, currency }) {
  const total = value.estimate?.total;
  const hasPoint = value.latitude != null && value.longitude != null;

  if (total != null) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-primary-600 px-3.5 py-3 text-white" role="status" aria-live="polite">
        <Receipt size={20} className="shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-primary-100">
            Frais d’enlèvement{value.distanceKm != null ? ` · ${formatDistance(value.distanceKm)} par la route` : ''}
          </p>
          <p className="font-heading text-lg font-bold leading-tight">{formatPrice(total, currency)}</p>
        </div>
        <span className="shrink-0 text-xs text-primary-100">ajouté au total</span>
      </div>
    );
  }

  return (
    <p className="flex items-center gap-2 rounded-xl bg-surface-50 px-3 py-2.5 text-xs text-surface-600" role="status" aria-live="polite">
      {hasPoint && <Loader2 size={14} className="shrink-0 animate-spin text-primary-600" aria-hidden="true" />}
      {hasPoint
        ? 'Calcul des frais d’enlèvement selon la distance…'
        : 'Indiquez le point d’enlèvement sur la carte : les frais s’affichent dès que la distance est calculée.'}
    </p>
  );
}

export default function PickupOption({ value, onChange, address, agence, communeId, currency }) {
  const set = (patch) => onChange({ ...value, ...patch });

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

      {value.domicile && <LiveFee value={value} currency={currency} />}

      {value.domicile && (
        <div className="space-y-3 border-t border-surface-100 pt-3">
          <HomeMissionFields value={value} onChange={onChange} agence={agence} communeId={communeId} kind="enlevement" currency={currency} />
          <p className="text-xs text-surface-500">
            Le tarif de l’enlèvement s’ajoute au prix de l’expédition. Il est fixé par la grille de l’agence selon la distance : tarif standard en retrait classique, majoré en récupération express.
          </p>
        </div>
      )}
    </div>
  );
}
