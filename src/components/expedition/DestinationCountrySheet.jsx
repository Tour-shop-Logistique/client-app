import { useMemo, useState } from 'react';
import { Search, Check, Globe2, AlertTriangle } from 'lucide-react';
import BottomSheet from '../common/BottomSheet';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import { getFlagEmoji, getCountryName } from '../../utils/countries';
import { isDestinationCompatible, destinationBadges } from '../../utils/expedition';

// Strips accents / collapses separators so "cote d ivoire" matches "Côte-d'Ivoire".
const normalize = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-'\s]+/g, ' ')
    .trim();

const label = (d) => getCountryName(d.code_pays) || d.nom || d.code_pays;

// Destination picker fed by GET /api/expedition/client/pays-disponibles: only
// countries actually tariffed from the departure backoffice, filtered to the
// active mode, each row showing its available expedition types as badges.
export default function DestinationCountrySheet({
  open,
  onClose,
  destinations,
  status,
  mode,
  currentCode,
  onSelect,
  onRetry,
}) {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const compatible = (destinations || []).filter((d) => isDestinationCompatible(d, mode));
    const q = normalize(query.trim());
    const filtered = q ? compatible.filter((d) => normalize(label(d)).includes(q)) : compatible;
    return [...filtered].sort((a, b) => label(a).localeCompare(label(b), 'fr'));
  }, [destinations, mode, query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={close} title="Pays de destination">
      <p className="mb-3 flex items-start gap-2 text-sm text-surface-500">
        <Globe2 size={18} className="mt-0.5 shrink-0 text-primary-600" />
        Seuls les pays avec une tarification active depuis votre pays de depart sont proposes.
      </p>

      {status === 'loading' && <LoadingSpinner label="Chargement des destinations..." />}

      {status === 'error' && (
        <EmptyState
          icon={AlertTriangle}
          title="Impossible de charger les destinations"
          description="Verifiez votre connexion puis reessayez."
          action={
            onRetry ? (
              <button type="button" className="btn-primary" onClick={onRetry}>
                Reessayer
              </button>
            ) : null
          }
        />
      )}

      {status === 'idle' && (
        <>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              className="input-field pl-9"
              placeholder="Rechercher un pays"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          {rows.length === 0 ? (
            <p className="p-4 text-center text-sm text-surface-500">
              Aucune destination disponible{mode ? ' pour ce mode' : ''}.
            </p>
          ) : (
            <div className="max-h-[55dvh] divide-y divide-surface-100 overflow-y-auto rounded-xl border border-surface-100">
              {rows.map((d) => {
                const badges = destinationBadges(d, mode);
                return (
                  <button
                    key={d.code_pays}
                    type="button"
                    onClick={() => {
                      onSelect(d.code_pays);
                      close();
                    }}
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-50"
                  >
                    <span className="text-lg leading-none">{getFlagEmoji(d.code_pays)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-surface-900">{label(d)}</span>
                      {badges.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {badges.map((b) => (
                            <span
                              key={b}
                              className="rounded bg-primary-50 px-1.5 py-0.5 text-[11px] font-medium text-primary-700"
                            >
                              {b}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    {currentCode === d.code_pays && <Check size={16} className="shrink-0 text-primary-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </BottomSheet>
  );
}
