import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { SuccessArt } from '../illustrations';

// En-tête des écrans de confirmation d'envoi : illustration animée + titre.
export default function SuccessHero({ title, subtitle, children }) {
  return (
    <div className="relative flex flex-col items-center overflow-hidden rounded-3xl bg-primary-50 px-5 pb-6 pt-2 text-center">
      <SuccessArt className="-mb-2 max-w-full" />
      <h2 className="font-heading text-2xl font-bold text-surface-900">{title}</h2>
      {subtitle && <p className="mt-1.5 text-body text-surface-500">{subtitle}</p>}
      {children}
    </div>
  );
}

// Numéro de suivi mis en avant, copiable en un geste.
export function CopyReference({ reference }) {
  const [copied, setCopied] = useState(false);
  if (!reference) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé) : rien à faire.
    }
  };

  return (
    <div className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-3.5 text-left shadow-card">
      <div className="min-w-0">
        <p className="text-caption text-surface-500">N° de suivi</p>
        <p className="truncate font-heading text-xl font-bold tracking-wide text-primary-700">{reference}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary-50 px-3 text-body font-semibold text-primary-700"
      >
        {copied ? <Check size={15} strokeWidth={2.6} /> : <Copy size={15} />}
        {copied ? 'Copié' : 'Copier'}
      </button>
    </div>
  );
}
