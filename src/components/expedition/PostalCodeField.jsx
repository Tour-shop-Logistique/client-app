import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { searchPostalAddresses } from '../../services/geocodingService';

// Champ « Code postal » avec suggestions d'adresse postale au fil de la saisie
// (Photon + Nominatim, voir services/geocodingService.js). Choisir une
// suggestion appelle `onPick({ postcode, city, state, street })` ; la saisie
// libre reste possible (`onChange(texte)`).

const DEBOUNCE_MS = 450;

export default function PostalCodeField({ value, onChange, onPick, countryCode, invalid = false, label = 'Code postal' }) {
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [open, setOpen] = useState(false);
  const skip = useRef(false); // pas de recherche juste après le choix d'une suggestion

  useEffect(() => {
    const q = (value || '').trim();
    if (skip.current) {
      skip.current = false;
      return undefined;
    }
    if (q.length < 2 || !open) {
      setResults([]);
      setStatus('idle');
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus('loading');
      searchPostalAddresses(q, { signal: controller.signal, countryCode })
        .then((r) => { setResults(r); setStatus('done'); })
        .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, countryCode, open]);

  const pick = (r) => {
    skip.current = true;
    onPick(r);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-surface-700">
        {label}
        <div className="relative">
          <input
            className={`input-field mt-1 py-2.5 pr-9 ${invalid ? 'border-red-400 ring-2 ring-red-100' : ''}`}
            placeholder="Ex : 75011"
            autoComplete="off"
            value={value || ''}
            onChange={(e) => { setOpen(true); onChange(e.target.value); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && open && results[0]) {
                e.preventDefault();
                pick(results[0]);
              } else if (e.key === 'Escape') setOpen(false);
            }}
          />
          {status === 'loading' && (
            <Loader2 size={16} className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 animate-spin text-surface-400" />
          )}
        </div>
      </label>

      {open && (value || '').trim().length >= 2 && (status === 'done' || status === 'error') && (
        <ul className="absolute inset-x-0 top-full z-[1000] mt-1 max-h-64 overflow-auto rounded-xl border border-surface-200 bg-white py-1 shadow-lg">
          {status === 'error' && (
            <li className="px-3 py-2 text-xs text-amber-700">Suggestions indisponibles : saisissez le code à la main.</li>
          )}
          {status === 'done' && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-surface-500">Aucune adresse trouvée.</li>
          )}
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-50"
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-primary-600" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-surface-900">{r.label}</span>
                  {r.detail && <span className="block truncate text-xs text-surface-500">{r.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
