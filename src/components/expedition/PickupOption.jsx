import { Building2, Truck } from 'lucide-react';
import HomeMissionFields from './HomeMissionFields';
import { OptionRow } from './OptionCard';
import { formatPrice } from '../../utils/format';

// Étape « Remise » : comment le colis arrive à l'agence de départ — dépôt en
// agence (par défaut, sans frais) ou enlèvement à domicile par un livreur.
// Le point d'enlèvement part de la position GPS du client (demandée dès que
// l'enlèvement est choisi) ; la distance PAR LA ROUTE depuis l'agence de départ
// est envoyée en `enlevement_distance_km`. Champs : HomeMissionFields ;
// valeur et payload : src/utils/pickup.js.

export default function PickupOption({ value, onChange, address, agence, communeId, currency }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const fee = value.domicile ? value.estimate?.total : null;

  return (
    <div className="space-y-3">
      <div className="space-y-2" role="group" aria-label="Méthode de remise du colis">
        <OptionRow
          selected={!value.domicile}
          onClick={() => set({ domicile: false })}
          icon={Building2}
          title="Je dépose le colis à l’agence"
          hint={agence?.nom_agence ? `À l’agence ${agence.nom_agence}` : 'Vous apportez le colis à l’agence de départ'}
          badge="Gratuit"
          badgeTone="success"
        />
        <OptionRow
          selected={value.domicile}
          onClick={() => set({ domicile: true })}
          icon={Truck}
          title="Un livreur vient le chercher"
          hint={address ? `À votre adresse : ${address}` : 'À l’adresse de l’expéditeur'}
          badge={fee != null ? formatPrice(fee, currency) : 'Selon la distance'}
          badgeTone={fee != null ? 'price' : 'neutral'}
        />
      </div>

      {value.domicile && (
        <div className="card space-y-3 p-3.5">
          <HomeMissionFields value={value} onChange={onChange} agence={agence} communeId={communeId} kind="enlevement" currency={currency} />
          <p className="text-xs text-surface-500">
            Le tarif de l’enlèvement s’ajoute au prix de l’expédition. Il est fixé par la grille de l’agence selon la distance : tarif standard en retrait classique, majoré en récupération express.
          </p>
        </div>
      )}
    </div>
  );
}
