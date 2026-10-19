import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { formatMoney } from '../../utils/marketplace';
import { MODE_META } from './deliveryModes';

// Les 3 modes de livraison marketplace (MARKETPLACE_LIVRAISON_3_MODES.md) avec
// leur prix. `tarifs` : { standard, express, livreur_magasin } — null = mode
// indisponible ; `livreur_magasin` null = le vendeur n'a pas de livreur : l'option
// est masquee. Sans `onSelect`, simple apercu (panier).

const ORDER = ['standard', 'express', 'livreur_magasin'];

export default function DeliveryModeOptions({
  tarifs, status, value, onSelect, compact = false, unpricedModes = [],
}) {
  if (status === 'loading' && !tarifs) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-surface-50 px-3 py-2.5 text-caption text-surface-500">
        <Loader2 size={14} className="animate-spin" /> Calcul des frais de livraison…
      </div>
    );
  }

  // Un mode est propose s'il a un prix, ou s'il est autorise sans prix connu
  // (`unpricedModes`, quand l'apercu des tarifs est impossible).
  const modes = ORDER.filter((m) => (tarifs?.[m] != null) || unpricedModes.includes(m));
  if (modes.length === 0) {
    return (
      <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-caption text-amber-800">
        Aucun tarif de livraison n’est disponible pour cette destination.
      </p>
    );
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'} role={onSelect ? 'radiogroup' : undefined}>
      {modes.map((m) => {
        const meta = MODE_META[m];
        const price = tarifs?.[m];
        const active = value === m;
        const Icon = meta.icon;
        const content = (
          <>
            <span className={`flex shrink-0 items-center justify-center rounded-xl ${compact ? 'h-8 w-8' : 'h-10 w-10'} ${active ? 'bg-shop-400 text-shop-950' : meta.tone}`}>
              <Icon size={compact ? 15 : 18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold text-surface-900">{meta.title}</span>
              {!compact && <span className="block text-caption text-surface-500">{meta.text}</span>}
            </span>
            <span className="shrink-0 text-right font-heading text-body font-bold text-surface-900">
              {price != null ? formatMoney(price) : <span className="font-sans text-caption font-medium text-surface-500">Calculé à la confirmation</span>}
            </span>
            {onSelect && (
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-shop-600 bg-shop-600 text-white' : 'border-surface-300'}`}>
                {active && <Check size={12} strokeWidth={3} />}
              </span>
            )}
          </>
        );
        if (!onSelect) {
          return (
            <div key={m} className="flex items-center gap-3 rounded-xl bg-surface-50 px-3 py-2">
              {content}
            </div>
          );
        }
        return (
          <motion.button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(m)}
            className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${
              active ? 'border-shop-400 bg-shop-50' : 'border-surface-100 bg-white hover:border-surface-200'
            }`}
          >
            {content}
          </motion.button>
        );
      })}
    </div>
  );
}
