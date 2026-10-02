import { EmptyState, Package, ShoppingBag, AlertTriangle } from 'client-app';

export const AucunColis = () => (
  <div className="max-w-md">
    <EmptyState
      icon={Package}
      title="Aucune expédition pour l'instant"
      description="Vos colis envoyés apparaîtront ici avec leur suivi en temps réel."
      action={<button type="button" className="btn-primary">Envoyer un colis</button>}
    />
  </div>
);

export const PanierVide = () => (
  <div className="max-w-md">
    <EmptyState icon={ShoppingBag} title="Votre panier est vide" description="Parcourez l'e-commerce pour trouver des articles." />
  </div>
);

export const Erreur = () => (
  <div className="max-w-md">
    <EmptyState
      icon={AlertTriangle}
      title="Impossible de charger les agences"
      description="Vérifiez votre connexion puis réessayez."
      action={<button type="button" className="btn-secondary">Réessayer</button>}
    />
  </div>
);
