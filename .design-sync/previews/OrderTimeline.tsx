import { MotionGlobalConfig, OrderTimeline } from 'client-app';

// Static card: jump framer-motion entry animations to their end state.
MotionGlobalConfig.skipAnimations = true;

const Box = ({ children }) => <div className="card max-w-md p-4">{children}</div>;

export const PaiementEnAttente = () => <Box><OrderTimeline commande={{ statut: 'en_attente_paiement' }} /></Box>;

export const EnLivraison = () => <Box><OrderTimeline commande={{ statut: 'payee', mode_livraison: 'reseau_livreurs' }} /></Box>;

export const Recue = () => <Box><OrderTimeline commande={{ statut: 'livree' }} /></Box>;
