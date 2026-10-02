import { OrderItemsCard } from 'client-app';

export const Articles = () => (
  <div className="max-w-md">
    <OrderItemsCard
      commande={{
        items: [
          { id: 1, titre_snapshot: 'Robe en wax, taille M', prix_unitaire: 15000 },
          { id: 2, titre_snapshot: 'Sac à main en cuir tressé', prix_unitaire: 22500 },
          { id: 3, titre_snapshot: 'Sandales artisanales', prix_unitaire: 8000 },
        ],
        montant_articles: 45500,
      }}
    />
  </div>
);
