import { useEffect, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { searchPlaces } from '../../services/geocodingService';

// Champ de recherche d'un lieu (quartier, rue, repère…). Les résultats
// s'affichent sous le champ ; en choisir un appelle `onSelect({ lat, lng, label })`.
// Saisie temporisée : le serveur Nominatim public tolère ~1 requête/s.

const DEBOUNCE_MS = 700;

export default function PlaceSearch({ onSelect, countryCode, near }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setStatus('idle');
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus('loading');
      searchPlaces(q, { signal: controller.signal, countryCode, near })
        .then((r) => { setResults(r); setStatus('done'); })
        .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
    // `near` est un objet recréé à chaque rendu : on ne suit que ses valeurs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, countryCode, near?.lat, near?.lng]);

  const pick = (place) => {
    onSelect(place);
    setQuery(place.label);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
      <input
        type="search"
        className="input-field pl-9 pr-9"
        placeholder="Rechercher un lieu (quartier, rue, repère…)"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault(); // pas de soumission du formulaire d'expédition
            if (results[0]) pick(results[0]);
          } else if (e.key === 'Escape') setOpen(false);
        }}
        aria-label="Rechercher un lieu d'enlèvement"
        autoComplete="off"
      />
      {status === 'loading' ? (
        <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-surface-400" />
      ) : query && (
        <button
          type="button"
          onClick={() => { setQuery(''); setResults([]); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-surface-400 hover:text-surface-600"
          aria-label="Effacer la recherche"
        >
          <X size={14} />
        </button>
      )}

      {open && query.trim().length >= 3 && status !== 'idle' && status !== 'loading' && (
        <ul className="absolute inset-x-0 top-full z-[1000] mt-1 max-h-64 overflow-auto rounded-xl border border-surface-200 bg-white py-1 shadow-lg">
          {status === 'error' && (
            <li className="px-3 py-2 text-xs text-amber-700">Recherche indisponible pour le moment. Touchez la carte pour placer le point.</li>
          )}
          {status === 'done' && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-surface-500">Aucun lieu trouvé. Essayez un autre nom ou touchez la carte.</li>
          )}
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => pick(p)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-50"
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-primary-600" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-surface-900">{p.label}</span>
                  {p.detail && <span className="block truncate text-xs text-surface-500">{p.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
