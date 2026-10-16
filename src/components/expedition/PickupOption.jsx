import { Building2, Truck } from 'lucide-react';
import HomeMissionFields, { Choice } from './HomeMissionFields';

// Remise du colis : dépôt en agence (par défaut) ou enlèvement à domicile.
// Le point d'enlèvement part de la position GPS du client (demandée dès que
// l'enlèvement est choisi) ; la distance PAR LA ROUTE depuis l'agence de départ
// est envoyée en `enlevement_distance_km`. Champs : HomeMissionFields ;
// valeur et payload : src/utils/pickup.js.

export default function PickupOption({ value, onChange, address, agence, communeId }) {
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

      {value.domicile && (
        <div className="space-y-3 border-t border-surface-100 pt-3">
          <HomeMissionFields value={value} onChange={onChange} agence={agence} communeId={communeId} kind="enlevement" />
          <p className="text-xs text-surface-500">
            Le tarif de l’enlèvement est fixé à part : offres des livreurs en récupération express, ou grille de l’agence selon la distance en retrait classique.
          </p>
        </div>
      )}
    </div>
  );
}
