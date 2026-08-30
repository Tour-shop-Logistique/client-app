import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import BottomSheet from './BottomSheet';
import LoadingSpinner from './LoadingSpinner';
import cityService from '../../services/cityService';

export default function CitySelectSheet({ open, onClose, codePays, onSelect, title = 'Choisissez une ville' }) {
  const [allCities, setAllCities] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open || !codePays) return;
    setStatus('loading');
    cityService
      .listCities(codePays)
      .then((cities) => {
        setAllCities(cities);
        setStatus('idle');
      })
      .catch(() => setStatus('error'));
  }, [open, codePays]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? allCities.filter((c) => c.toLowerCase().includes(q)) : allCities;
    return base.slice(0, 100);
  }, [allCities, query]);

  const trimmedQuery = query.trim();
  const showCustomOption =
    status !== 'loading' &&
    trimmedQuery.length > 0 &&
    !allCities.some((c) => c.toLowerCase() === trimmedQuery.toLowerCase());

  const handleSelect = (city) => {
    onSelect(city);
    setQuery('');
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          className="input-field pl-9"
          placeholder="Rechercher une ville"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {status === 'loading' && <LoadingSpinner label="Chargement des villes..." />}
      {status === 'error' && (
        <p className="mb-3 text-sm text-red-600">
          Impossible de charger la liste des villes pour ce pays. Vous pouvez saisir le nom de la ville directement ci-dessus.
        </p>
      )}

      {showCustomOption && (
        <button
          type="button"
          onClick={() => handleSelect(trimmedQuery)}
          className="mb-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-primary-300 p-3 text-left text-sm text-primary-700"
        >
          <Plus size={16} /> Utiliser "{trimmedQuery}"
        </button>
      )}

      {status === 'idle' && (
        <div className="max-h-[50dvh] divide-y divide-surface-100 overflow-y-auto rounded-xl border border-surface-100">
          {filtered.length === 0 && !showCustomOption && (
            <p className="p-4 text-center text-sm text-surface-500">Aucune ville trouvee.</p>
          )}
          {filtered.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => handleSelect(city)}
              className="flex w-full items-center p-3 text-left text-sm hover:bg-surface-50"
            >
              <span className="text-surface-900">{city}</span>
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
