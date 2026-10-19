import { Truck, Zap, Store } from 'lucide-react';

// Presentation des 3 modes de livraison marketplace (MARKETPLACE_LIVRAISON_3_MODES.md).
export const MODE_META = {
  standard: {
    icon: Truck,
    title: 'Standard',
    text: 'Un livreur TourShop est affecté à votre commande.',
    tone: 'bg-primary-50 text-primary-600',
  },
  express: {
    icon: Zap,
    title: 'Express',
    text: 'Proposée à tous les livreurs disponibles : le premier qui accepte part tout de suite.',
    tone: 'bg-amber-50 text-amber-700',
  },
  livreur_magasin: {
    icon: Store,
    title: 'Livreur du vendeur',
    text: 'Le vendeur vous livre avec son propre livreur, au tarif qu’il a fixé.',
    tone: 'bg-teal-50 text-teal-700',
  },
};
