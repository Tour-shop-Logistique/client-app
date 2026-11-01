import { useLocation } from 'react-router-dom';
import { hidesBottomNav } from '../routes';

// true sur les parcours plein ecran (voir IMMERSIVE_ROUTES) : la navigation du
// bas n'est pas affichee et les barres d'action se calent en bas de l'ecran.
export default function useBottomNavHidden() {
  const { pathname } = useLocation();
  return hidesBottomNav(pathname);
}
