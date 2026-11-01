import { Building2, MapPin, Phone, Home } from 'lucide-react';
import { useDispatch } from 'react-redux';
import BottomSheet from '../common/BottomSheet';
import ExpeditionStatusBadge from './ExpeditionStatusBadge';
import { openAuthSheet } from '../../store/slices/uiSlice';
import { getFlagEmoji, getCountryName } from '../../utils/countries';
import { getTypeLabel } from '../../utils/expeditionStatus';
import { formatDate } from '../../utils/format';

// Résultat du suivi public (POST /expedition/suivi, sans compte) : l'API renvoie
// une vue réduite — pas de montants ni de données personnelles — avec `id: null`.
// Voir user-parcour/api-client-livreur.md.

function Agence({ title, agence }) {
  if (!agence) return null;
  const phone = String(agence.telephone || '').trim();
  return (
    <div className="rounded-2xl bg-surface-50 p-3">
      <p className="mb-1 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-surface-500">
        <Building2 size={13} aria-hidden="true" /> {title}
      </p>
      <p className="text-sm font-semibold text-surface-900">{agence.nom_agence || '—'}</p>
      {agence.adresse && <p className="text-xs text-surface-500">{agence.adresse}</p>}
      {phone && (
        <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700">
          <Phone size={13} aria-hidden="true" /> {phone}
        </a>
      )}
    </div>
  );
}

const Country = ({ code }) => (
  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-surface-900">
    {code ? `${getFlagEmoji(code)} ${getCountryName(code) || code}` : '—'}
  </span>
);

export default function PublicTrackingSheet({ expedition, open, onClose, isAuthenticated }) {
  const dispatch = useDispatch();
  if (!expedition) return null;

  return (
    <BottomSheet open={open} onClose={onClose} title="Suivi du colis">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption text-surface-500">Référence</p>
            <p className="truncate font-heading text-lg font-bold text-surface-900">{expedition.reference}</p>
          </div>
          <ExpeditionStatusBadge statut={expedition.statut_expedition} />
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-surface-100">
          <MapPin size={16} className="shrink-0 text-primary-600" aria-hidden="true" />
          <Country code={expedition.pays_depart} />
          <span className="text-surface-300" aria-hidden="true">→</span>
          <Country code={expedition.pays_destination} />
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px] font-medium text-surface-600">
          {expedition.type_expedition && <span className="rounded-full bg-surface-100 px-2 py-0.5">{getTypeLabel(expedition.type_expedition)}</span>}
          {expedition.created_at && <span className="rounded-full bg-surface-100 px-2 py-0.5">Créée le {formatDate(expedition.created_at)}</span>}
          {expedition.is_livraison_domicile && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
              <Home size={11} aria-hidden="true" /> Livraison à domicile
            </span>
          )}
        </div>

        <Agence title="Agence de départ" agence={expedition.agence_depart} />
        <Agence title="Agence d’arrivée" agence={expedition.agence_arrivee} />

        {!isAuthenticated && (
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => { onClose(); dispatch(openAuthSheet({ mode: 'login', reason: 'default' })); }}
          >
            Se connecter pour suivre mes colis
          </button>
        )}
        <button type="button" className="btn-ghost w-full" onClick={onClose}>Fermer</button>
      </div>
    </BottomSheet>
  );
}
