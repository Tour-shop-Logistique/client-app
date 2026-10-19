import { useMemo, useState } from 'react';
import { Check, MapPin, Search } from 'lucide-react';
import BottomSheet from '../common/BottomSheet';
import LoadingSpinner from '../common/LoadingSpinner';
import { normalizeSearch } from '../../utils/colisFormat';

// Commune d'arrivée (Interville) : recherche insensible aux accents dans la
// liste des communes du pays, avec les destinations récentes en raccourci.
// La valeur retenue est l'id de la commune (`destinataire_commune_id`).
export default function CommuneSelectSheet({ open, onClose, communes = [], status, onRetry, currentId, recent = [], onSelect }) {
  const [query, setQuery] = useState('');
  const q = normalizeSearch(query);
  const visible = useMemo(
    () => (q ? communes.filter((c) => normalizeSearch(c.nom).includes(q)) : communes),
    [communes, q]
  );

  const close = () => {
    setQuery('');
    onClose();
  };
  const pick = (commune) => {
    onSelect(commune);
    close();
  };

  return (
    <BottomSheet open={open} onClose={close} title="Commune de destination">
      <div className="relative mb-3">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          type="search"
          className="input-field pl-9"
          placeholder="Rechercher une commune"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Rechercher une commune"
        />
      </div>

      {status === 'loading' && <LoadingSpinner label="Chargement des communes..." />}

      {status === 'error' && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <p>Impossible de charger les communes. Vérifiez votre connexion.</p>
          <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">
            Réessayer
          </button>
        </div>
      )}

      {status !== 'loading' && status !== 'error' && (
        <>
          {!q && recent.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-surface-500">Récentes</p>
              <div className="flex flex-wrap gap-2">
                {recent.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick(c)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary-50 px-4 text-sm font-semibold text-primary-700 active:scale-95"
                  >
                    <MapPin size={14} /> {c.nom}
                  </button>
                ))}
              </div>
            </div>
          )}

          {visible.length === 0 ? (
            <p className="rounded-xl bg-surface-50 p-4 text-center text-sm text-surface-500">
              {communes.length === 0 ? 'Aucune commune disponible pour ce pays.' : `Aucune commune ne correspond à « ${query.trim()} ».`}
            </p>
          ) : (
            <ul className="divide-y divide-surface-100 rounded-xl border border-surface-100">
              {visible.map((c) => {
                const active = c.id === currentId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pick(c)}
                      aria-pressed={active}
                      className={`flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm ${active ? 'bg-primary-50' : 'active:bg-surface-50'}`}
                    >
                      <MapPin size={16} className={active ? 'text-primary-600' : 'text-surface-400'} />
                      <span className={`flex-1 ${active ? 'font-semibold text-primary-800' : 'text-surface-900'}`}>{c.nom}</span>
                      {active && <Check size={17} className="text-primary-600" strokeWidth={2.6} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </BottomSheet>
  );
}
