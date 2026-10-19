import { useMemo, useState } from 'react';
import { Check, Package, Search } from 'lucide-react';
import BottomSheet from '../common/BottomSheet';
import {
  fitsWeight, formatDims, formatHint, normalizeSearch, sortFormats, suggestFormat,
} from '../../utils/colisFormat';

// Au-delà de ce nombre de formats, une recherche par nom est proposée.
const SEARCH_FROM = 7;

const fmtKg = (v) => `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`;

// Liste complète des formats du backoffice, du plus petit au plus grand.
// Conçue pour un nombre de formats quelconque : liste qui défile, recherche dès
// 7 formats, format conseillé selon le poids saisi, formats trop petits signalés.
export default function FormatSelectSheet({ open, onClose, formats = [], currentId, poids, onSelect }) {
  const [query, setQuery] = useState('');
  const sorted = useMemo(() => sortFormats(formats), [formats]);
  const suggested = suggestFormat(formats, poids);
  const hasWeight = Number(poids) > 0;

  const q = normalizeSearch(query);
  const visible = q ? sorted.filter((f) => normalizeSearch(f.nom).includes(q)) : sorted;

  const close = () => {
    setQuery('');
    onClose();
  };
  const pick = (format) => {
    onSelect(format);
    close();
  };

  // L'icône grandit avec le rang du format : la taille se lit d'un coup d'œil.
  const iconSize = (format) => {
    const rank = sorted.indexOf(format);
    const last = Math.max(sorted.length - 1, 1);
    return Math.round(14 + (10 * rank) / last);
  };

  return (
    <BottomSheet open={open} onClose={close} title="Format du colis">
      {hasWeight && (
        <p className="mb-3 text-caption text-surface-500">
          Colis de {fmtKg(poids)} : le format le plus adapté est marqué Conseillé.
        </p>
      )}

      {formats.length >= SEARCH_FROM && (
        <div className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="search"
            className="input-field pl-9"
            placeholder={`Rechercher parmi ${formats.length} formats`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Rechercher un format"
          />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl bg-surface-50 p-4 text-center text-sm text-surface-500">
          Aucun format ne correspond à « {query.trim()} ».
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((f) => {
            const active = f.id === currentId;
            const fits = fitsWeight(f, poids);
            const isSuggested = suggested?.id === f.id;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => pick(f)}
                  aria-pressed={active}
                  className={`flex min-h-[64px] w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
                    active ? 'border-primary-600 bg-primary-50' : 'border-surface-200 bg-white'
                  }`}
                >
                  <span
                    className={`icon-tile h-11 w-11 rounded-xl ${
                      active ? 'bg-white text-primary-600' : fits ? 'bg-primary-50 text-primary-600' : 'bg-surface-100 text-surface-400'
                    }`}
                  >
                    <Package size={iconSize(f)} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-sm font-semibold ${fits ? 'text-surface-900' : 'text-surface-500'}`}>{f.nom}</span>
                      {isSuggested && (
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700">Conseillé</span>
                      )}
                      {!fits && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Trop petit pour {fmtKg(poids)}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-caption text-surface-500">
                      {formatHint(f)} · {formatDims(f) || 'dimensions libres'}
                    </span>
                  </span>
                  {active && <Check size={18} className="shrink-0 text-primary-600" strokeWidth={2.6} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
