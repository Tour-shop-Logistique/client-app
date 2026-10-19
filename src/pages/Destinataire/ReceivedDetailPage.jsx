import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle, Building2, Home, Info, Package, Route as RouteIcon, Truck,
} from 'lucide-react';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ExpeditionStatusBadge from '../../components/expedition/ExpeditionStatusBadge';
import TrackingTimeline from '../../components/expedition/TrackingTimeline';
import MissionRequest from '../../components/expedition/MissionRequest';
import PaymentSection from '../../components/expedition/PaymentSection';
import destinataireService from '../../services/destinataireService';
import { getStatutMeta, CLOSED_STATUSES } from '../../utils/expeditionStatus';
import { formatPrice } from '../../utils/format';
import { arrivalAgence } from '../../utils/expedition';
import {
  getReceived, rememberReceived, recipientMission, saveRecipientMission, canRequestHomeDelivery,
} from '../../utils/received';
import { ROUTES } from '../../routes';

// Détail d'un colis reçu (user-parcour/CHANGEMENTS_APPS_CLIENT_LIVREUR.md §4) :
// suivi, demande de livraison à domicile quand l'expéditeur avait choisi le
// retrait en agence (le destinataire paie alors le livreur), paiement du
// livreur et des frais restants par preuve.
// Pas de route de détail destinataire : l'expédition vient de la liste ou de la
// recherche (cache mémoire), sinon on parcourt `mes-expeditions`.

const MAX_PAGES = 5;

async function findReceived(id) {
  const cached = getReceived(id);
  if (cached) return cached;
  for (let p = 1; p <= MAX_PAGES; p += 1) {
    const res = await destinataireService.myShipments(p);
    rememberReceived(res.items);
    const hit = res.items.find((e) => String(e.id) === String(id));
    if (hit) return hit;
    if (p >= res.lastPage) break;
  }
  return null;
}

const MISSION_STATUT = {
  en_attente: 'Recherche d’un livreur',
  proposee: 'Livreur en cours d’affectation',
  assignee: 'Livreur assigné',
  terminee: 'Livrée',
};

export default function ReceivedDetailPage() {
  const { id } = useParams();
  const [exp, setExp] = useState(() => getReceived(id));
  const [loading, setLoading] = useState(!getReceived(id));
  const [mission, setMission] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!exp) {
      setLoading(true);
      findReceived(id)
        .then((e) => { if (alive) setExp(e); })
        .catch(() => {})
        .finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
  }, [id, exp]);

  useEffect(() => { if (exp) setMission(recipientMission(exp)); }, [exp]);

  if (loading) {
    return (
      <div>
        <TopBar title="Colis reçu" back />
        <LoadingSpinner label="Chargement du colis..." />
      </div>
    );
  }

  if (!exp) {
    return (
      <div>
        <TopBar title="Colis reçu" back />
        <div className="page-container py-10">
          <EmptyState
            icon={AlertTriangle}
            title="Colis introuvable"
            description="Ce colis ne vous est pas destiné, ou sa référence est incorrecte."
            action={<Link to={ROUTES.RECEIVED} className="btn-primary">Retour à mes colis reçus</Link>}
          />
        </div>
      </div>
    );
  }

  const statut = getStatutMeta(exp.statut_expedition);
  const agence = arrivalAgence(exp);
  const closed = CLOSED_STATUSES.includes(exp.statut_expedition);
  const requestable = !mission && canRequestHomeDelivery(exp);
  // Réponse de `rechercher` volontairement réduite : pas de dates de jalons.
  const hasMilestones = Boolean(exp.created_at || exp.date_reception_agence || exp.date_livraison_agence);
  const missionPrice = mission?.montant_fixe ?? mission?.montant_final ?? mission?.montant;

  const onRequested = (res) => {
    const m = res?.mission ?? res?.data ?? null;
    const updated = { ...exp, is_livraison_domicile: true, livraison_payee_par_destinataire: true };
    if (m?.id) {
      saveRecipientMission(exp.id, m);
      setMission(m);
    }
    rememberReceived(updated);
    setExp(updated);
  };

  return (
    <div>
      <TopBar title={exp.reference || 'Colis reçu'} subtitle="Colis qui vous est destiné" back />

      <div className="page-container space-y-3 pb-6 pt-2">
        <section className="card overflow-hidden">
          <div className="brand-gradient p-4">
            <p className="text-xs uppercase tracking-wide text-white/70">Référence</p>
            <p className="truncate text-lg font-bold">{exp.reference || '—'}</p>
            <p className="mt-2 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">{statut.label}</p>
          </div>
          <dl className="divide-y divide-surface-100 px-4 text-sm">
            {exp.pays_depart && (
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-surface-500">Provenance</dt><dd className="text-right font-medium text-surface-800">{exp.pays_depart}</dd></div>
            )}
            {exp.pays_destination && (
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-surface-500">Destination</dt><dd className="text-right font-medium text-surface-800">{exp.pays_destination}</dd></div>
            )}
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-surface-500">Remise</dt>
              <dd className="text-right font-medium text-surface-800">{exp.is_livraison_domicile ? 'Livraison à domicile' : 'Retrait en agence'}</dd>
            </div>
          </dl>
        </section>

        {hasMilestones && (
          <section className="card p-4">
            <div className="mb-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="icon-tile h-9 w-9 rounded-xl bg-primary-100 text-primary-600"><RouteIcon size={17} /></span>
                <h2 className="font-heading text-[15px] font-semibold text-surface-900">Suivi</h2>
              </div>
              <ExpeditionStatusBadge statut={exp.statut_expedition} />
            </div>
            <TrackingTimeline expedition={exp} />
          </section>
        )}

        {agence && (
          <section className="card p-4">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="icon-tile h-9 w-9 rounded-xl bg-teal-100 text-teal-600"><Building2 size={17} /></span>
              <h2 className="font-heading text-[15px] font-semibold text-surface-900">Agence d’arrivée</h2>
            </div>
            <p className="text-sm font-semibold text-surface-900">{agence.nom_agence || agence.nom || '—'}</p>
            {(agence.adresse || agence.ville) && (
              <p className="text-sm text-surface-500">{[agence.adresse, agence.ville].filter(Boolean).join(', ')}</p>
            )}
          </section>
        )}

        {/* Livraison à domicile demandée par le destinataire */}
        {!closed && (mission || requestable || !exp.is_livraison_domicile) && (
          <section className="card p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="icon-tile h-9 w-9 rounded-xl bg-orange-100 text-amber-700"><Home size={17} /></span>
              <h2 className="font-heading text-[15px] font-semibold text-surface-900">Livraison chez vous</h2>
            </div>

            {mission ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-50 p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-surface-900">
                    <Truck size={15} className="text-primary-600" /> Livraison {mission.mode === 'groupage' ? 'classique' : 'express'}
                  </p>
                  <p className="text-xs text-surface-500">{MISSION_STATUT[mission.statut] || 'Demande envoyée'}</p>
                </div>
                {missionPrice != null && (
                  <span className="shrink-0 font-heading text-sm font-bold text-surface-900">{formatPrice(missionPrice, mission.devise)}</span>
                )}
              </div>
            ) : requestable ? (
              <MissionRequest expedition={exp} kind="livraison" viewer="destinataire" onDone={onRequested} />
            ) : (
              <p className="flex items-start gap-2 rounded-xl bg-surface-50 px-3 py-2.5 text-sm text-surface-600">
                <Info size={16} className="mt-0.5 shrink-0 text-primary-600" />
                Dès que le colis sera arrivé à l’agence, vous pourrez demander à être livré à domicile.
              </p>
            )}
          </section>
        )}

        {/* Paiement : livreur (si livraison demandée par le destinataire) et frais restants. */}
        {!closed && (exp.livraison_payee_par_destinataire || mission) && (
          <PaymentSection expedition={exp} viewer="destinataire" driverMission={mission} />
        )}

        {closed && (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-surface-100 px-3 py-2.5 text-center text-xs text-surface-500">
            <Package size={14} /> Ce colis est {statut.label.toLowerCase()}.
          </p>
        )}
      </div>
    </div>
  );
}
