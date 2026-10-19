import { useCallback, useEffect, useState } from 'react';
import {
  Ban, Bike, Car, KeyRound, Loader2, MapPin, MessageCircle, Phone, RefreshCw, Truck, UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import BottomSheet from '../common/BottomSheet';
import MissionRequest from './MissionRequest';
import expeditionService from '../../services/expeditionService';
import { formatDateTime, formatPrice, expeditionCurrency } from '../../utils/format';
import { storageUrl, handleMediaError } from '../../utils/marketplace';

// Dernier kilomètre d'une expédition (cahier 4.2 / 4.3, workflow 8.3) :
//  - missions d'enlèvement / de livraison à domicile (GET /{id}/missions) ;
//  - en express, prix imposé par le backend (`montant_fixe`) : la course est
//    diffusée aux livreurs et le premier qui accepte la prend — plus d'offres
//    à comparer (user-parcour/CHANGEMENTS_APPS_CLIENT_LIVREUR.md §2) ;
//  - code de réception à transmettre au livreur ;
//  - preuves (photo, signature, heure, position) une fois l'étape réalisée.
// Contrat : REPONSE_AUDIT_CAHIER_DES_CHARGES_CLIENT.md §1 et §2, enrichi par
// REPONSE_DEMANDE_BACKEND_APP_CLIENT_COMPLETE.md C3 (mode, montant, livreur
// assigné, annulation d'une mission encore ouverte).
// Le temps réel est géré par la page (useRealtimeExpedition) : chaque
// événement change `refreshKey`, qui recharge les missions.

const MISSION_LABEL = { enlevement: 'Enlèvement à domicile', livraison: 'Livraison à domicile' };

const MISSION_STATUT = {
  en_attente: { label: 'Recherche d’un livreur', className: 'bg-amber-50 text-amber-700' },
  // Groupage : le backoffice a proposé la mission à un livreur, qui a 15 min
  // pour l'accepter (PARCOURS_LIVREUR_API.md §4.1bis).
  proposee: { label: 'Livreur en cours d’affectation', className: 'bg-amber-50 text-amber-700' },
  assignee: { label: 'Livreur assigné', className: 'bg-primary-50 text-primary-700' },
  terminee: { label: 'Effectuée', className: 'bg-emerald-50 text-emerald-700' },
};

// Groupage : le backoffice assigne un livreur rattaché. Express : course
// diffusée au réseau. Dans les deux cas le tarif est fixé d'avance.
const isGroupage = (m) => m.mode === 'groupage';
const statutOf = (m) => (m.statut === 'en_attente' && isGroupage(m)
  ? { label: 'En attente d’un livreur', className: 'bg-amber-50 text-amber-700' }
  : MISSION_STATUT[m.statut]);

const missionAmount = (m) => m?.montant ?? m?.montant_final ?? m?.montant_fixe ?? null;
// Enlèvement : tarif de la commune de départ (devise d'origine). Livraison :
// commune d'arrivée — devise de destination si l'API la fournit.
const missionCurrency = (m, exp) => (m.type === 'livraison'
  ? m.devise ?? exp?.devise_destination ?? undefined
  : m.devise ?? expeditionCurrency(exp));
const phoneDigits = (t) => String(t || '').replace(/[^\d+]/g, '');

// Livreur assigné (`livreur` n'est renseigné qu'à partir de `assignee`).
function CourierCard({ livreur }) {
  const nom = [livreur.prenoms, livreur.nom].filter(Boolean).join(' ') || 'Livreur TourShop';
  const VehicleIcon = livreur.type_vehicule === 'voiture' ? Car : Bike;
  const tel = phoneDigits(livreur.telephone);
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-surface-100 p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <UserRound size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-surface-900">{nom}</p>
        {livreur.type_vehicule && (
          <p className="flex items-center gap-1 text-xs capitalize text-surface-500">
            <VehicleIcon size={13} /> {livreur.type_vehicule}
          </p>
        )}
      </div>
      {tel && (
        <div className="flex shrink-0 gap-1.5">
          <a href={`tel:${tel}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-600" aria-label={`Appeler ${nom}`}>
            <Phone size={16} />
          </a>
          <a
            href={`https://wa.me/${tel.replace(/^\+/, '')}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
            aria-label={`Écrire à ${nom} sur WhatsApp`}
          >
            <MessageCircle size={16} />
          </a>
        </div>
      )}
    </div>
  );
}

// Annulation d'une mission encore `en_attente` (aucun livreur assigné).
function CancelMission({ mission, onDone }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = mission.type === 'enlevement' ? 'l’enlèvement à domicile' : 'la livraison à domicile';

  const run = async () => {
    setBusy(true);
    try {
      await expeditionService.cancelMission(mission.id);
      toast.success('Demande annulée', {
        description: mission.type === 'enlevement' ? 'Déposez le colis vous-même à l’agence.' : 'Le colis sera à retirer à l’agence.',
      });
      setOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Annulation impossible : un livreur a peut-être déjà été assigné.');
    } finally {
      setBusy(false);
      onDone();
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-red-600">
        <Ban size={14} /> Annuler {label}
      </button>
      <BottomSheet open={open} onClose={() => !busy && setOpen(false)} title="Annuler cette demande ?">
        <div className="space-y-3">
          <p className="text-sm text-surface-600">
            Plus aucun livreur ne viendra pour {label}.
          </p>
          <button type="button" className="btn w-full bg-red-600 text-white" onClick={run} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />} Confirmer l’annulation
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => setOpen(false)} disabled={busy}>
            Retour
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

// Une seule demande active par type et par expédition (422 sinon).
const ACTIVE_MISSION = ['en_attente', 'proposee', 'assignee'];
const hasMission = (missions, type) =>
  missions.some((m) => m.type === type && (ACTIVE_MISSION.includes(m.statut) || m.statut === 'terminee'));

// Enlèvement : tant que le colis n'a pas été remis à l'agence de départ.
const PICKUP_REQUESTABLE = ['en_attente', 'accepted'];
// Livraison à domicile : jusqu'au départ en livraison. Pas pour le type
// `simple` (LD), déjà livré à domicile sans mission (PARCOURS_LIVREUR_API.md §4).
const DELIVERY_CLOSED = ['en_cours_livraison', 'termined', 'cancelled', 'refused'];

// Signature : URL, data URL ou base64 brut (le livreur l'envoie en base64).
const signatureSrc = (data) => (/^(data:|https?:)/i.test(String(data)) ? data : `data:image/png;base64,${data}`);

// Contrat api-enlevement-livraison-client.md : `preuve: { photo, signature,
// latitude, longitude }`. Les anciens noms (`photo_url`, `signature_data`,
// `horodatage`) restent lus en repli.
const normalizeProof = (p) => ({
  photo: storageUrl(p.photo ?? p.photo_url ?? null),
  signature: p.signature ?? p.signature_data ?? null,
  latitude: p.latitude ?? null,
  longitude: p.longitude ?? null,
  horodatage: p.horodatage ?? p.created_at ?? null,
});

function Proof({ preuve: raw }) {
  const preuve = normalizeProof(raw);
  const hasPosition = preuve.latitude != null && preuve.longitude != null;
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-surface-50 p-3">
      <p className="text-xs font-semibold text-surface-700">
        Preuve{preuve.horodatage ? ` · ${formatDateTime(preuve.horodatage)}` : ''}
      </p>
      {(preuve.photo || preuve.signature) && (
        <div className="grid grid-cols-2 gap-2">
          {preuve.photo && (
            <a href={preuve.photo} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg bg-white">
              <img src={preuve.photo} onError={handleMediaError} alt="Photo prise par le livreur" className="aspect-square w-full object-cover" loading="lazy" />
            </a>
          )}
          {preuve.signature && (
            <div className="flex items-center justify-center rounded-lg bg-white p-2">
              <img src={signatureSrc(preuve.signature)} alt="Signature" className="max-h-28 w-full object-contain" />
            </div>
          )}
        </div>
      )}
      {hasPosition && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${preuve.latitude},${preuve.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600"
        >
          <MapPin size={12} /> Voir la position enregistrée
        </a>
      )}
    </div>
  );
}

export default function DeliverySection({ expedition, refreshKey = 0 }) {
  const [missions, setMissions] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    expeditionService
      .clientMissions(expedition.id)
      .then((res) => setMissions(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setError(true));
  }, [expedition.id]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const visible = (missions ?? []).filter((m) => statutOf(m));
  const expStatut = expedition.statut_expedition;
  const canRequestPickup = missions !== null && PICKUP_REQUESTABLE.includes(expStatut) && !hasMission(missions, 'enlevement');
  const canRequestDelivery = missions !== null
    && expedition.type_expedition !== 'simple'
    && Boolean(expStatut) && !DELIVERY_CLOSED.includes(expStatut)
    && !hasMission(missions, 'livraison');
  if (!error && visible.length === 0 && !canRequestPickup && !canRequestDelivery) return null;

  return (
    <section className="card p-4">
      <div className="mb-1 flex items-center gap-2 text-primary-600">
        <Truck size={16} />
        <h2 className="text-sm font-semibold text-surface-900">Livreur</h2>
      </div>

      {error && (
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600">
          <RefreshCw size={14} /> Informations indisponibles, réessayer
        </button>
      )}

      <div className="divide-y divide-surface-100">
        {visible.map((m) => {
          const statut = statutOf(m);
          const showCode = m.type === 'livraison' && m.statut === 'assignee' && expedition.code_validation_reception;
          return (
            <div key={m.id} className="py-3 first:pt-2 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-surface-900">{MISSION_LABEL[m.type] || 'Mission'}</p>
                  {missionAmount(m) != null && (
                    <p className="text-xs text-surface-500">
                      {isGroupage(m) ? 'Tarif fixe' : 'Tarif express'} : <span className="font-semibold text-surface-800">{formatPrice(missionAmount(m), missionCurrency(m, expedition))}</span>
                      {m.type === 'livraison' && expedition.livraison_payee_par_destinataire && <> · payé par le destinataire</>}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statut.className}`}>{statut.label}</span>
              </div>

              {m.livreur && <CourierCard livreur={m.livreur} />}

              {m.statut === 'en_attente' && !isGroupage(m) && (
                <p className="mt-3 rounded-xl bg-surface-50 px-3 py-2.5 text-sm text-surface-600">
                  Course express diffusée aux livreurs disponibles, au prix fixé ci-dessus. Le premier qui l'accepte la prend en charge : vous serez prévenu.
                </p>
              )}
              {(m.statut === 'proposee' || (m.statut === 'en_attente' && isGroupage(m))) && (
                <p className="mt-3 rounded-xl bg-surface-50 px-3 py-2.5 text-sm text-surface-600">
                  TourShop affecte un livreur à votre demande, au tarif fixé par l'agence. Vous serez prévenu dès qu'il l'aura acceptée.
                </p>
              )}

              {showCode && (
                <div className="mt-3 flex items-start gap-3 rounded-xl border border-primary-100 bg-primary-50/60 p-3">
                  <KeyRound size={18} className="mt-0.5 shrink-0 text-primary-600" />
                  <div className="min-w-0">
                    <p className="text-sm text-surface-700">
                      Code de réception : <span className="font-heading text-lg font-bold tracking-widest text-surface-900">{expedition.code_validation_reception}</span>
                    </p>
                    <p className="text-xs text-surface-500">
                      Envoyé au destinataire par SMS et email. Il le donne au livreur à la remise du colis.
                    </p>
                  </div>
                </div>
              )}

              {m.preuve && <Proof preuve={m.preuve} />}

              {m.statut === 'en_attente' && <CancelMission mission={m} onDone={load} />}
            </div>
          );
        })}
      </div>

      {(canRequestPickup || canRequestDelivery) && (
        <div className={`space-y-2 ${visible.length ? 'mt-3 border-t border-surface-100 pt-3' : 'mt-2'}`}>
          {canRequestPickup && <MissionRequest expedition={expedition} kind="enlevement" onDone={load} />}
          {canRequestDelivery && <MissionRequest expedition={expedition} kind="livraison" onDone={load} />}
        </div>
      )}
    </section>
  );
}
