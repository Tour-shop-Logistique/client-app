import { motion } from 'framer-motion';
import { Check, ClipboardList, Wallet, Truck, PackageCheck } from 'lucide-react';
import { orderSteps } from '../../utils/marketplace';

const ICONS = { commande: ClipboardList, paiement: Wallet, livraison: Truck, recu: PackageCheck };

// Frise horizontale Commande -> Paiement -> Livraison -> Recue.
export default function OrderTimeline({ commande }) {
  // Commande annulee (acheteur, vendeur ou expiration 48 h) : pas de progression.
  if (commande?.statut === 'annulee') return null;
  const steps = orderSteps(commande);
  const doneCount = steps.filter((s) => s.state === 'done').length;
  const progress = Math.min(1, (doneCount - 1 + (steps.some((s) => s.state === 'current') ? 0.5 : 0)) / (steps.length - 1));

  return (
    <div className="relative px-2 pt-1">
      <div className="absolute left-7 right-7 top-[1.35rem] h-1 rounded-full bg-surface-100" />
      <motion.div
        className="absolute left-7 right-7 top-[1.35rem] h-1 origin-left rounded-full bg-gradient-to-r from-shop-400 to-emerald-500"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: Math.max(0, progress) }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      <ol className="relative flex justify-between">
        {steps.map((step, i) => {
          const Icon = ICONS[step.key];
          const done = step.state === 'done';
          const current = step.state === 'current';
          return (
            <li key={step.key} className="flex w-16 flex-col items-center gap-1.5 text-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 * i }}
                className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : current
                      ? 'border-shop-400 bg-shop-50 text-shop-800'
                      : 'border-surface-200 bg-white text-surface-300'
                }`}
              >
                {current && <span className="absolute inset-0 animate-ping rounded-full bg-shop-300 opacity-40" />}
                {done ? <Check size={18} strokeWidth={3} /> : <Icon size={17} />}
              </motion.span>
              <span className={`text-caption font-medium ${done || current ? 'text-surface-900' : 'text-surface-400'}`}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
