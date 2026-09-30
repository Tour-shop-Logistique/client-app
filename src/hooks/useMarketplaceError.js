import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ROUTES } from '../routes';
import { apiErrorMessage, isAbonnementBloque } from '../utils/marketplace';

/**
 * Gestion d'erreur des ecrans marketplace. Un 403 `ABONNEMENT_BLOQUE` redirige
 * vers l'ecran de regularisation (section 9.6) au lieu d'un toast generique.
 * Renvoie `true` si l'erreur a ete traitee comme un blocage.
 */
export default function useMarketplaceError() {
  const navigate = useNavigate();

  return useCallback(
    (err, fallback) => {
      if (isAbonnementBloque(err)) {
        toast.error('Abonnement marketplace en retard', {
          description: 'Régularisez votre abonnement pour accéder à votre espace vendeur.',
        });
        navigate(ROUTES.MARKETPLACE_SUBSCRIPTION, { replace: true });
        return true;
      }
      if (err?.response?.status !== 401) toast.error(apiErrorMessage(err, fallback));
      return false;
    },
    [navigate]
  );
}
