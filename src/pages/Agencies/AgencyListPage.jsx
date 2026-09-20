import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { MapPinned, Search, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import '../../utils/leafletIcons';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import CountrySelectSheet from '../../components/common/CountrySelectSheet';
import useGeolocation from '../../hooks/useGeolocation';
import { fetchAgencies } from '../../store/slices/agencySlice';
import { agencyPath } from '../../routes';
import { getFlagEmoji } from '../../utils/countries';

const DEFAULT_CENTER = [5.35, -4.02]; // Abidjan

export default function AgencyListPage() {
  const dispatch = useDispatch();
  const { items, status } = useSelector((state) => state.agencies);
  const country = useSelector((state) => state.country);
  const { position, locate } = useGeolocation();
  const [query, setQuery] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [countrySheetOpen, setCountrySheetOpen] = useState(!country.code);

  useEffect(() => {
    if (!country.code) {
      setCountrySheetOpen(true);
      return;
    }
    dispatch(fetchAgencies({ code_pays: country.code }));
  }, [dispatch, country.code]);

  const filtered = items.filter((a) =>
    (a.nom_agence || '').toLowerCase().includes(query.toLowerCase())
  );
  const center = position ? [position.lat, position.lng] : DEFAULT_CENTER;

  return (
    <div className="min-h-dvh bg-surface-50 safe-top">
      <div className="brand-gradient relative overflow-hidden pb-12 pt-4">
        <div className="pointer-events-none absolute -right-8 -top-14 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 left-4 h-32 w-32 rounded-full bg-shop-400/20" />

        <div className="page-container relative flex items-center justify-between gap-2">
          <h1 className="font-heading text-lg font-bold text-white">Agences</h1>
          <button
            type="button"
            onClick={() => setCountrySheetOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/25"
          >
            {country.code && <span className="text-base leading-none">{getFlagEmoji(country.code)}</span>}
            {country.name || 'Choisir un pays'}
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <div className="page-container relative -mt-8 space-y-4 pb-4">
        <div className="card flex gap-2 p-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              className="input-field pl-9"
              placeholder="Rechercher une agence"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setShowMap((v) => !v);
              if (!position) locate();
            }}
            className="btn-secondary px-3"
            aria-label="Voir sur la carte"
          >
            <MapPinned size={18} />
          </button>
        </div>

        {showMap && (
          <div className="card h-56 overflow-hidden">
            <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-full w-full">
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filtered
                .filter((a) => a.latitude && a.longitude)
                .map((a) => (
                  <Marker key={a.id} position={[parseFloat(a.latitude), parseFloat(a.longitude)]}>
                    <Popup>{a.nom_agence}</Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>
        )}

        {!country.code && (
          <EmptyState
            icon={MapPinned}
            title="Choisissez votre pays"
            description="Selectionnez un pays pour afficher les agences disponibles."
            action={
              <button type="button" className="btn-primary" onClick={() => setCountrySheetOpen(true)}>
                Choisir un pays
              </button>
            }
          />
        )}

        {country.code && status === 'loading' && <LoadingSpinner label="Chargement des agences..." />}

        {country.code && status === 'error' && (
          <EmptyState
            icon={AlertTriangle}
            title="Impossible de charger les agences"
            description="Verifiez votre connexion puis reessayez."
            action={
              <button
                type="button"
                className="btn-primary"
                onClick={() => dispatch(fetchAgencies({ code_pays: country.code }))}
              >
                Reessayer
              </button>
            }
          />
        )}

        {country.code && status === 'idle' && filtered.length === 0 && (
          <EmptyState
            icon={MapPinned}
            title="Aucune agence trouvee"
            description={`Aucune agence disponible en ${country.name} pour le moment.`}
          />
        )}

        {country.code && status === 'idle' && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((agency) => (
              <Link key={agency.id} to={agencyPath(agency.id)} className="card flex items-start gap-3 p-4">
                {agency.logo ? (
                  <img
                    src={agency.logo}
                    alt={agency.nom_agence}
                    className="mt-0.5 h-9 w-9 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-600">
                    <MapPinned size={18} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-surface-900">{agency.nom_agence}</p>
                  <p className="truncate text-xs text-surface-500">
                    {[agency.adresse, agency.commune || agency.ville].filter(Boolean).join(', ')}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 self-center text-surface-300" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <CountrySelectSheet
        open={countrySheetOpen}
        onClose={() => setCountrySheetOpen(false)}
        currentCode={country.code}
      />
    </div>
  );
}
