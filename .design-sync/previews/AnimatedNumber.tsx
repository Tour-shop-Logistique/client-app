import { MotionGlobalConfig, AnimatedNumber, Wallet } from 'client-app';

// Static card: jump framer-motion entry animations to their end state.
MotionGlobalConfig.skipAnimations = true;

const fcfa = (n) => n.toLocaleString('fr-FR') + ' FCFA';

export const Solde = () => (
  <div className="brand-gradient max-w-sm rounded-3xl p-5 text-white">
    <p className="flex items-center gap-2 text-caption font-medium text-white/80"><Wallet size={14} /> Solde disponible</p>
    <AnimatedNumber value={128500} format={fcfa} className="mt-1 block font-heading text-display" />
  </div>
);

export const Kpis = () => (
  <div className="grid max-w-md grid-cols-2 gap-3">
    <div className="card p-4">
      <p className="text-caption text-surface-500">Colis envoyés</p>
      <AnimatedNumber value={42} className="font-heading text-title text-surface-900" />
    </div>
    <div className="card p-4">
      <p className="text-caption text-surface-500">Gains parrainage</p>
      <AnimatedNumber value={7500} format={fcfa} className="font-heading text-title text-surface-900" />
    </div>
  </div>
);
