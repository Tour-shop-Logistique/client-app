import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Search, Check, Globe2 } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { setCountry } from '../../store/slices/countrySlice';
import { COUNTRY_OPTIONS } from '../../utils/countries';

// Strips accents and collapses spaces/hyphens/apostrophes so "Cote d'Ivoire"
// matches the data's "Côte-d'Ivoire".
const normalize = (str) =>
  str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-'\s]+/g, ' ')
    .trim();

export default function CountrySelectSheet({
  open,
  onClose,
  currentCode,
  onSelect,
  title = 'Choisissez votre pays',
  description = 'Selectionnez votre pays pour afficher les agences TourShop pres de chez vous.',
}) {
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((c) => normalize(c.label).includes(q));
  }, [query]);

  const handleSelect = (code) => {
    if (onSelect) {
      onSelect(code);
    } else {
      dispatch(setCountry(code));
    }
    setQuery('');
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <p className="mb-4 flex items-start gap-2 text-sm text-surface-500">
        <Globe2 size={18} className="mt-0.5 shrink-0 text-primary-600" />
        {description}
      </p>

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

      <div className="max-h-[50dvh] divide-y divide-surface-100 overflow-y-auto rounded-xl border border-surface-100">
        {filtered.length === 0 && (
          <p className="p-4 text-center text-sm text-surface-500">Aucun pays trouve.</p>
        )}
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => handleSelect(c.id)}
            className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-surface-50"
          >
            <span className="flex items-center gap-2 text-surface-900">
              <span className="text-lg leading-none">{c.flag}</span>
              {c.label}
            </span>
            {currentCode === c.id && <Check size={16} className="shrink-0 text-primary-600" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
