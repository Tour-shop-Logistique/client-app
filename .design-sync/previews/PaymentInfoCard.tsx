import { PaymentInfoCard } from 'client-app';

export const MobileMoney = () => (
  <div className="max-w-md">
    <PaymentInfoCard
      commande={{ payment_method_choisi: 'mobile_money', reference_paiement: 'OM-240918-77412', paiement_declare_le: '2026-09-18T14:32:00' }}
    />
  </div>
);

export const CashLivraison = () => (
  <div className="max-w-md">
    <PaymentInfoCard title="Paiement prévu" commande={{ payment_method_choisi: 'cash' }} />
  </div>
);
