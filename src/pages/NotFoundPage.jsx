import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';

export default function NotFoundPage() {
  return (
    <div className="page-container flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-4xl font-bold text-surface-300">404</p>
      <p className="text-sm text-surface-500">Cette page n'existe pas.</p>
      <Link to={ROUTES.HOME} className="btn-primary mt-2">
        Retour a l'accueil
      </Link>
    </div>
  );
}
