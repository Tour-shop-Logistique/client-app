import { useState } from 'react';
import { AlertTriangle, ChevronRight, Package, Ruler } from 'lucide-react';
import FormatSelectSheet from './FormatSelectSheet';
import {
  applyFormat, fitsWeight, formatDims, formatHasDims, formatHint, overweight, sortFormats, suggestFormat,
} from '../../utils/colisFormat';

// Jusqu'à ce nombre, les formats s'affichent en pastilles sur une ligne ;
// au-delà, le format choisi s'affiche seul et la liste complète s'ouvre en feuille.
const INLINE_MAX = 3;

// Choix du format d'un colis (Petit / Moyen / Grand…) : les dimensions du format
// sont remplies automatiquement. Un format sans dimensions (illimité), ou
// l'absence de formats, laisse le client saisir longueur / largeur / hauteur.
// `colis` : { poids, longueur, largeur, hauteur, format_colis_id }.
export default function ColisFormatFields({ colis, formats = [], status = 'idle', onChange, idPrefix = 'colis' }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const selected = formats.find((f) => f.id === colis.format_colis_id) || null;
  const autoDims = formatHasDims(selected);
  const tooHeavy = overweight(colis, selected);
  const suggested = tooHeavy ? suggestFormat(formats, colis.poids) : null;
  const pick = (format) => onChange(applyFormat(colis, format));
  const setDim = (key) => (e) => onChange({ ...colis, [key]: e.target.value.replace(',', '.') });

  return (
    <div className="space-y-3">
      {status === 'loading' && formats.length === 0 && <span className="skeleton block h-14 w-full rounded-xl" aria-label="Chargement des formats" />}
      {status === 'error' && (
        <p className="text-caption text-amber-700">Formats indisponibles : indiquez les dimensions du colis.</p>
      )}

      {formats.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-surface-700">Format du colis</p>
          {formats.length <= INLINE_MAX ? (
            <div className="grid grid-cols-3 gap-2">
              {sortFormats(formats).map((f) => {
                const active = f.id === colis.format_colis_id;
                const fits = fitsWeight(f, colis.poids);
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => pick(f)}
                    className={`flex min-h-[56px] flex-col items-center justify-center rounded-xl border px-1.5 py-2 text-center transition active:scale-[0.98] ${
                      active ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-surface-200 bg-white text-surface-800'
                    } ${fits ? '' : 'opacity-60'}`}
                  >
                    <span className="block w-full truncate text-sm font-semibold">{f.nom}</span>
                    <span className="block w-full truncate text-[11px] text-surface-500">{formatHint(f)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className={`flex min-h-[60px] w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
                  selected ? 'border-primary-600 bg-primary-50' : 'border-surface-200 bg-white'
                }`}
              >
                <span className={`icon-tile h-10 w-10 rounded-xl ${selected ? 'bg-white text-primary-600' : 'bg-surface-100 text-surface-500'}`}>
                  <Package size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-semibold ${selected ? 'text-surface-900' : 'text-surface-500'}`}>
                    {selected ? selected.nom : 'Choisir un format'}
                  </span>
                  <span className="block truncate text-caption text-surface-500">
                    {selected
                      ? `${formatHint(selected)}${autoDims ? '' : ' · dimensions libres'}`
                      : `${formats.length} formats disponibles`}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-0.5 text-caption font-semibold text-primary-700">
                  Changer <ChevronRight size={15} />
                </span>
              </button>
              <FormatSelectSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                formats={formats}
                currentId={colis.format_colis_id}
                poids={colis.poids}
                onSelect={pick}
              />
            </>
          )}
        </div>
      )}

      {tooHeavy && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-caption text-amber-800" role="alert">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p>
              Le format {selected.nom} accepte {formatHint(selected).replace("jusqu'à ", '')} au maximum.
              {!suggested && ' Aucun format n’accepte ce poids : répartissez le contenu sur plusieurs colis.'}
            </p>
            {suggested && (
              <button
                type="button"
                onClick={() => pick(suggested)}
                className="mt-2 inline-flex min-h-9 items-center rounded-lg bg-white px-3 font-semibold text-amber-800 ring-1 ring-amber-200 active:scale-95"
              >
                Passer au format {suggested.nom}
              </button>
            )}
          </div>
        </div>
      )}

      {autoDims ? (
        <p className="flex items-center gap-2 rounded-xl bg-surface-50 px-3 py-2.5 text-caption text-surface-600">
          <Ruler size={14} className="shrink-0 text-primary-600" />
          Dimensions du format : <strong className="text-surface-900">{formatDims(selected)}</strong>
        </p>
      ) : (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-surface-700">Dimensions (cm, optionnel)</legend>
          <div className="grid grid-cols-3 gap-2">
            {[['longueur', 'Longueur'], ['largeur', 'Largeur'], ['hauteur', 'Hauteur']].map(([key, label]) => (
              <label key={key} htmlFor={`${idPrefix}-${key}`} className="block text-center text-caption text-surface-500">
                <input
                  id={`${idPrefix}-${key}`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  className="input-field mb-1 text-center"
                  value={colis[key] ?? ''}
                  onChange={setDim(key)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
