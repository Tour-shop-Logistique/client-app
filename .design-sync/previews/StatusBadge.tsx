import { StatusBadge, COMMANDE_STATUTS, LIVRAISON_STATUTS, ANNONCE_STATUTS } from 'client-app';

export const Commande = () => (
  <div className="flex flex-wrap gap-2">
    <StatusBadge map={COMMANDE_STATUTS} value="en_attente_paiement" />
    <StatusBadge map={COMMANDE_STATUTS} value="paiement_a_confirmer" />
    <StatusBadge map={COMMANDE_STATUTS} value="payee" />
    <StatusBadge map={COMMANDE_STATUTS} value="livree" />
  </div>
);

export const Court = () => (
  <div className="flex flex-wrap gap-2">
    <StatusBadge map={COMMANDE_STATUTS} value="en_attente_paiement" short />
    <StatusBadge map={COMMANDE_STATUTS} value="paiement_a_confirmer" short />
  </div>
);

export const LivraisonEtAnnonce = () => (
  <div className="flex flex-wrap gap-2">
    <StatusBadge map={LIVRAISON_STATUTS} value="en_attente" />
    <StatusBadge map={LIVRAISON_STATUTS} value="en_cours" />
    <StatusBadge map={ANNONCE_STATUTS} value="brouillon" />
    <StatusBadge map={ANNONCE_STATUTS} value="masquee" />
  </div>
);
