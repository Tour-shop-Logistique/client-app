import { DeliveryInfoCard } from 'client-app';

export const EnCours = () => (
  <div className="max-w-md">
    <DeliveryInfoCard commande={{ mode_livraison: 'reseau_livreurs', livraison_marketplace: { statut: 'en_cours', montant_final: 1500 } }} />
  </div>
);

export const HorsPlateforme = () => (
  <div className="max-w-md">
    <DeliveryInfoCard commande={{ mode_livraison: 'hors_plateforme' }} />
  </div>
);
