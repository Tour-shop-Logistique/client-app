import { useNavigate } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import TopBar from '../components/common/TopBar';
import EmptyState from '../components/common/EmptyState';
import { ROUTES } from '../routes';

/**
 * Shown in place of any screen whose backend isn't wired yet
 * (see src/config/features.js).
 */
export default function PageUnavailable({ title = 'Page non disponible' }) {
  const navigate = useNavigate();

  return (
    <div>
      <TopBar title={title} back />
      <div className="page-container py-10">
        <EmptyState
          icon={Wrench}
          title="Bientôt disponible"
          description="Cette fonctionnalité n'est pas encore connectée au serveur. Elle sera activée dès que le backend correspondant sera prêt."
          action={
            <button type="button" className="btn-primary mt-2" onClick={() => navigate(ROUTES.HOME)}>
              Retour à l'accueil
            </button>
          }
        />
      </div>
    </div>
  );
}
