// Choix entre deux ou trois modes sur toute la largeur (ex. connexion par
// téléphone ou par email) — même rendu que l'app livreur.
// `options` : [{ key, label, icon? }].
export default function MethodSwitch({ options, value, onChange, label }) {
  return (
    <div
      className="grid gap-1 rounded-xl bg-surface-100 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label={label}
    >
      {options.map((o) => {
        const active = o.key === value;
        const Icon = o.icon;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition ${
              active ? 'bg-white text-surface-900 shadow-card' : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            {Icon && <Icon size={15} aria-hidden="true" />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
