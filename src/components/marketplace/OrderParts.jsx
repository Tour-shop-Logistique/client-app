import { motion } from 'framer-motion';
import { Package, Truck, KeyRound, Copy, Receipt, User } from 'lucide-react';
import StatusBadge from './StatusBadge';
import {
  formatMoney, personName, initials, storageUrl, handleMediaError, copyText, LIVRAISON_STATUTS, MODES_LIVRAISON, PAYMENT_METHODS,
} from '../../utils/marketplace';
import { formatDateTime } from '../../utils/format';

export function PersonRow({ label, person }) {
  if (!person) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-shop-300 to-teal-400 text-caption font-bold text-shop-950">
        {initials(person) || <User size={16} />}
      </span>
      <div className="min-w-0">
        <p className="text-caption text-surface-400">{label}</p>
        <p className="truncate text-body font-semibold text-surface-900">{personName(person)}</p>
      </div>
    </div>
  );
}

export function OrderItemsCard({ commande }) {
  const items = commande?.items ?? [];
  return (
    <section className="card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-body font-semibold text-surface-900">
        <Package size={16} className="text-surface-400" /> Articles ({items.length})
      </h2>
      <ul className="space-y-2.5">
        {items.map((it) => (
          <li key={it.id} className="flex items-start justify-between gap-3">
            <span className="text-body text-surface-700">{it.titre_snapshot}</span>
            <span className="shrink-0 text-body font-semibold text-surface-900">{formatMoney(it.prix_unitaire)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-dashed border-surface-200 pt-3">
        <span className="text-body font-semibold text-surface-900">Total</span>
        <span className="font-heading text-lg font-bold text-surface-900">{formatMoney(commande?.montant_articles)}</span>
      </div>
    </section>
  );
}

export function PaymentInfoCard({ commande, title = 'Paiement déclaré' }) {
  if (!commande?.payment_method_choisi) return null;
  const proof = storageUrl(commande.preuve_paiement_path);
  return (
    <section className="card space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-body font-semibold text-surface-900">
        <Receipt size={16} className="text-surface-400" /> {title}
      </h2>
      <dl className="grid grid-cols-2 gap-3 text-body">
        <div>
          <dt className="text-caption text-surface-400">Moyen</dt>
          <dd className="font-medium text-surface-800">{PAYMENT_METHODS[commande.payment_method_choisi] ?? commande.payment_method_choisi}</dd>
        </div>
        <div>
          <dt className="text-caption text-surface-400">Référence</dt>
          <dd className="truncate font-medium text-surface-800">{commande.reference_paiement || '—'}</dd>
        </div>
        {commande.paiement_declare_le && (
          <div className="col-span-2">
            <dt className="text-caption text-surface-400">Déclaré le</dt>
            <dd className="font-medium text-surface-800">{formatDateTime(commande.paiement_declare_le)}</dd>
          </div>
        )}
      </dl>
      {proof && (
        <a href={proof} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-surface-200">
          <img src={proof} onError={handleMediaError} alt="Preuve de paiement" className="max-h-56 w-full bg-surface-50 object-contain" />
        </a>
      )}
    </section>
  );
}

export function DeliveryInfoCard({ commande }) {
  const liv = commande?.livraison_marketplace;
  if (!commande?.mode_livraison && !liv) return null;
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-body font-semibold text-surface-900">
          <Truck size={16} className="text-surface-400" /> Livraison
        </h2>
        {liv?.statut && <StatusBadge map={LIVRAISON_STATUTS} value={liv.statut} />}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-body">
        <div>
          <dt className="text-caption text-surface-400">Mode</dt>
          <dd className="font-medium text-surface-800">{MODES_LIVRAISON[commande.mode_livraison] ?? (liv?.mode === 'direct' ? 'Livreur choisi' : 'Réseau de livreurs')}</dd>
        </div>
        {liv?.montant_final != null && (
          <div>
            <dt className="text-caption text-surface-400">Frais de livraison</dt>
            <dd className="font-medium text-surface-800">{formatMoney(liv.montant_final)}</dd>
          </div>
        )}
      </dl>
      {commande.mode_livraison === 'hors_plateforme' && (
        <p className="rounded-xl bg-surface-50 p-3 text-caption text-surface-600">
          Le vendeur organise lui-même la livraison, en dehors de l’application.
        </p>
      )}
    </section>
  );
}

// Code a 4 chiffres a communiquer au livreur a la remise (section 1.4).
export function DeliveryCodeCard({ code }) {
  if (!code) return null;
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="brand-gradient relative overflow-hidden rounded-3xl p-5"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <p className="flex items-center gap-2 text-caption font-medium text-white/80">
        <KeyRound size={14} /> Code de remise
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {String(code).split('').map((digit, i) => (
            <motion.span
              key={i}
              initial={{ rotateX: 90, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex h-14 w-12 items-center justify-center rounded-xl bg-white/15 font-heading text-3xl font-bold backdrop-blur"
            >
              {digit}
            </motion.span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => copyText(String(code), 'Code copié')}
          className="rounded-full bg-white/20 p-2.5 backdrop-blur transition hover:bg-white/30"
          aria-label="Copier le code"
        >
          <Copy size={18} />
        </button>
      </div>
      <p className="mt-3 text-caption text-white/80">
        Donnez ce code au livreur uniquement quand vous recevez votre article.
      </p>
    </motion.section>
  );
}
