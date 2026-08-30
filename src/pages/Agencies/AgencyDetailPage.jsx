import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Clock, Phone, MapPin, MessageCircle } from 'lucide-react';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import agencyService from '../../services/agencyService';

const DAY_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function Horaires({ horaires }) {
  if (!Array.isArray(horaires) || horaires.length === 0) return null;
  const sorted = [...horaires].sort((a, b) => DAY_ORDER.indexOf(a.jour) - DAY_ORDER.indexOf(b.jour));
  return (
    <div className="space-y-1">
      {sorted.map((h) => (
        <div key={h.jour} className="flex items-center justify-between text-surface-700">
          <span>{h.jour}</span>
          <span>{h.ferme ? 'Ferme' : `${h.ouverture} - ${h.fermeture}`}</span>
        </div>
      ))}
    </div>
  );
}

export default function AgencyDetailPage() {
  const { id } = useParams();
  const cached = useSelector((state) => state.agencies.items.find((a) => a.id === id));
  const [agency, setAgency] = useState(cached || null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached) {
      setAgency(cached);
      setLoading(false);
      return;
    }
    agencyService
      .getById(id)
      .then((data) => setAgency(data.agence ?? data))
      .catch(() => setAgency(null))
      .finally(() => setLoading(false));
  }, [id, cached]);

  return (
    <div>
      <TopBar title="Agence" back />
      {loading && <LoadingSpinner />}

      {!loading && !agency && <div className="page-container py-4 text-sm text-surface-500">Agence introuvable.</div>}

      {!loading && agency && (
        <div>
          <div className="aspect-[16/9] w-full bg-surface-100">
            {(agency.photos?.[0] || agency.logo) && (
              <img
                src={agency.photos?.[0] || agency.logo}
                alt={agency.nom_agence}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="page-container space-y-4 py-4">
            <div>
              <h1 className="text-lg font-bold text-surface-900">{agency.nom_agence}</h1>
              {agency.description && <p className="mt-1 text-sm text-surface-500">{agency.description}</p>}
              {agency.message_accueil && (
                <p className="mt-1 text-sm text-surface-500">{agency.message_accueil}</p>
              )}
            </div>

            <div className="card divide-y divide-surface-100 p-4 text-sm">
              <div className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                <MapPin size={16} className="mt-0.5 shrink-0 text-primary-600" />
                <span className="text-surface-700">
                  {[agency.adresse, agency.commune, agency.ville, agency.pays].filter(Boolean).join(', ')}
                </span>
              </div>
              {agency.horaires && (
                <div className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                  <Clock size={16} className="mt-0.5 shrink-0 text-primary-600" />
                  <Horaires horaires={agency.horaires} />
                </div>
              )}
              {agency.telephone && (
                <div className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                  <Phone size={16} className="mt-0.5 shrink-0 text-primary-600" />
                  <span className="text-surface-700">{agency.telephone}</span>
                </div>
              )}
            </div>

            {agency.telephone && (
              <a
                href={`https://wa.me/${agency.telephone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary w-full"
              >
                <MessageCircle size={16} /> Discuter sur WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
