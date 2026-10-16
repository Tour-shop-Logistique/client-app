import { AlertTriangle, Ruler } from 'lucide-react';
import { applyFormat, formatDims, formatHasDims, formatHint, overweight } from '../../utils/colisFormat';

// Choix du format d'un colis (Petit / Moyen / Grand…) : les dimensions du format
// sont remplies automatiquement. Un format sans dimensions (illimité), ou
// l'absence de formats, laisse le client saisir longueur / largeur / hauteur.
// `colis` : { poids, longueur, largeur, hauteur, format_colis_id }.

export default function ColisFormatFields({ colis, formats = [], status = 'idle', onChange }) {
  const selected = formats.find((f) => f.id === colis.format_colis_id) || null;
  const autoDims = formatHasDims(selected);
  const setDim = (key) => (e) => onChange({ ...colis, [key]: e.target.value });

  return (
    <div className="space-y-3">
      {status === 'loading' && <p className="text-xs text-surface-400">Chargement des formats de colis...</p>}
      {status === 'error' && (
        <p className="text-xs text-amber-600">Formats indisponibles : indiquez les dimensions du colis.</p>
      )}

      {formats.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-surface-700">Format du colis</p>
          <div className="grid grid-cols-3 gap-2">
            {formats.map((f) => {
              const active = f.id === colis.format_colis_id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(applyFormat(colis, f))}
                  className={`rounded-xl border p-2.5 text-left text-xs transition ${
                    active ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-surface-200 text-surface-600'
                  }`}
                >
                  <span className="block text-sm font-semibold">{f.nom}</span>
                  <span className="block text-[11px] text-surface-500">{formatHint(f)}</span>
                  <span className="block text-[11px] text-surface-400">{formatDims(f) || 'dimensions libres'}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {autoDims ? (
        <p className="flex items-center gap-2 rounded-xl bg-surface-50 px-3 py-2 text-xs text-surface-600">
          <Ruler size={14} className="shrink-0 text-primary-600" />
          Dimensions du format : <strong className="text-surface-900">{formatDims(selected)}</strong>
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {[['longueur', 'Longueur'], ['largeur', 'Largeur'], ['hauteur', 'Hauteur']].map(([key, label]) => (
            <label key={key} className="block text-xs font-medium text-surface-600">
              {label} (cm)
              <input type="number" min="0" className="input-field mt-1.5" value={colis[key] ?? ''} onChange={setDim(key)} />
            </label>
          ))}
        </div>
      )}

      {overweight(colis, selected) && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Le format {selected.nom} accepte {selected.poids_max} kg maximum : choisissez un format plus grand.
        </p>
      )}
    </div>
  );
}
