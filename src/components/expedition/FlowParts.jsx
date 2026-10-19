import { AlertTriangle, Check, ChevronRight } from 'lucide-react';

// Petites briques partagées par les parcours d'envoi (Interville, International).

// Champ de sélection tactile (ouvre une feuille) : icône, valeur, aide.
export function PickerButton({ icon, title, subtitle, selected, onClick, trailing = ChevronRight, disabled = false, ...rest }) {
  const Icon = icon;
  const Trailing = trailing;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-16 w-full items-center gap-3 rounded-xl border px-3 text-left transition active:scale-[0.99] disabled:opacity-60 ${
        selected ? 'border-primary-600 bg-primary-50' : 'border-surface-200 bg-white'
      }`}
      {...rest}
    >
      <span className={`icon-tile h-10 w-10 rounded-xl ${selected ? 'bg-white text-primary-600' : 'bg-surface-100 text-surface-500'}`}>
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-semibold ${selected ? 'text-surface-900' : 'text-surface-500'}`}>{title}</span>
        {subtitle && <span className="block truncate text-caption text-surface-500">{subtitle}</span>}
      </span>
      <Trailing size={18} className="shrink-0 text-surface-400" />
    </button>
  );
}

// Liaison visuelle départ -> arrivée à gauche de deux champs empilés.
// Les marges sont calées sur un libellé (20 px + 6 px) et un champ de 64 px.
export function RouteRail() {
  return (
    <div className="flex flex-col items-center pb-[26px] pt-[52px]" aria-hidden="true">
      <span className="h-3 w-3 shrink-0 rounded-full border-[3px] border-primary-600 bg-white" />
      <span className="my-1 w-0 flex-1 border-l-2 border-dashed border-primary-200" />
      <span className="h-3 w-3 shrink-0 rounded-full bg-primary-600 ring-[3px] ring-primary-100" />
    </div>
  );
}

export function ErrorNote({ message, onRetry }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700" role="alert">
      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p>{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-1.5 font-semibold underline">
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}

// Ligne libellé / valeur des récapitulatifs.
export function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <span className="shrink-0 text-surface-500">{label}</span>
      <span className="min-w-0 text-right font-medium text-surface-900">{value}</span>
    </div>
  );
}

// Expéditeur complet, replié en une ligne (prérempli depuis le compte).
export function ContactSummary({ title, data, onEdit }) {
  return (
    <button type="button" onClick={onEdit} className="card flex min-h-[72px] w-full items-center gap-3 p-4 text-left">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
        <Check size={15} strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-caption text-surface-500">{title}</span>
        <span className="block truncate text-sm font-semibold text-surface-900">{data.nom_prenom}</span>
        <span className="block truncate text-caption text-surface-500">
          {[data.telephone, data.adresse, data.ville].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="shrink-0 text-caption font-semibold text-primary-700">Modifier</span>
    </button>
  );
}
