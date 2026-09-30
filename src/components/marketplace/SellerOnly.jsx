import { useSelector } from 'react-redux';
import TopBar from '../common/TopBar';
import GuestGate from './GuestGate';

// Ecrans vendeur : un invite voit la porte de connexion au lieu d'appels 401.
export default function SellerOnly({ children }) {
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  if (isAuthenticated) return children;
  return (
    <div>
      <TopBar title="Espace vendeur" back />
      <div className="page-container py-4">
        <GuestGate title="Espace vendeur" description="Connectez-vous pour gérer vos annonces et vos ventes." />
      </div>
    </div>
  );
}
