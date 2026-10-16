import { useState } from 'react';
import { Home, Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import BottomSheet from '../common/BottomSheet';
import HomeMissionFields from './HomeMissionFields';
import expeditionService from '../../services/expeditionService';
import { missionRequestPayload } from '../../utils/pickup';

// Demande d'enlèvement ou de livraison à domicile APRÈS la création de
// l'expédition (api-enlevement-livraison-client.md) :
//  - POST /expedition/client/{id}/demander-enlevement (chez l'expéditeur,
//    depuis l'agence de départ) — seul moyen en mode `recuperation_agence` ;
//  - POST /expedition/client/{id}/demander-livraison (chez le destinataire,
//    depuis l'agence d'arrivée).
// Le mode (groupage | express) est définitif une fois la demande envoyée.

const COPY = {
  enlevement: {
    icon: Truck,
    cta: 'Faire récupérer le colis à domicile',
    hint: 'Un livreur vient chercher le colis chez l’expéditeur et le dépose à l’agence.',
    title: 'Enlèvement à domicile',
    submit: 'Demander l’enlèvement',
  },
  livraison: {
    icon: Home,
    cta: 'Faire livrer chez le destinataire',
    hint: 'Un livreur apporte le colis de l’agence d’arrivée jusque chez le destinataire.',
    title: 'Livraison à domicile',
    submit: 'Demander la livraison',
  },
};

// Agence d'arrivée : nom de relation non garanti dans `show` — lecture défensive.
const arrivalAgence = (exp) =>
  exp?.agence_arrivee ?? exp?.agenceArrivee ?? exp?.agence_destination ?? exp?.agenceDestination ?? null;

const initialValue = (exp, kind) => {
  const who = kind === 'enlevement' ? 'expediteur' : 'destinataire';
  return {
    mode: 'express',
    vehicule: 'moto',
    latitude: exp?.[`${who}_latitude`] ?? null,
    longitude: exp?.[`${who}_longitude`] ?? null,
    distanceKm: null,
    instructions: (kind === 'enlevement' ? exp?.instructions_enlevement : exp?.instructions_livraison) || '',
  };
};

export default function MissionRequest({ expedition, kind, onDone }) {
  const copy = COPY[kind];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(() => initialValue(expedition, kind));

  const agence = kind === 'enlevement' ? expedition.agence : arrivalAgence(expedition);
  const communeId = kind === 'enlevement'
    ? expedition.agence?.commune_id
    : agence?.commune_id ?? expedition.destinataire_commune_id;

  const openSheet = () => {
    setValue(initialValue(expedition, kind));
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const payload = missionRequestPayload(value);
      const res = kind === 'enlevement'
        ? await expeditionService.requestPickup(expedition.id, payload)
        : await expeditionService.requestHomeDelivery(expedition.id, payload);
      toast.success(res?.message || 'Demande envoyée.', {
        description: value.mode === 'express'
          ? 'Les offres des livreurs vont arriver ici : comparez-les puis choisissez.'
          : 'TourShop affecte un livreur au tarif fixé par l’agence.',
      });
      setOpen(false);
      onDone?.();
    } catch (err) {
      const data = err.response?.data;
      toast.error(
        data?.message
          || Object.values(data?.errors || {}).flat()[0]
          || 'Impossible d’envoyer la demande pour le moment.',
      );
    } finally {
      setBusy(false);
    }
  };

  const Icon = copy.icon;
  const pointMissing = value.latitude == null || value.longitude == null;

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="flex w-full items-start gap-3 rounded-xl border border-dashed border-primary-200 bg-primary-50/40 p-3 text-left"
      >
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-primary-600">
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-primary-700">{copy.cta}</span>
          <span className="block text-xs text-surface-500">{copy.hint}</span>
        </span>
      </button>

      <BottomSheet open={open} onClose={() => !busy && setOpen(false)} title={copy.title}>
        <div className="space-y-4">
          <HomeMissionFields value={value} onChange={setValue} agence={agence} communeId={communeId} kind={kind} />
          {pointMissing && (
            <p className="text-xs text-amber-700">
              Sans position, le livreur n’aura que l’adresse écrite pour se repérer.
            </p>
          )}
          <p className="text-xs text-surface-500">Le mode choisi ne pourra plus être modifié ensuite (vous pourrez seulement annuler la demande).</p>
          <button type="button" className="btn-primary w-full" onClick={submit} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />} {copy.submit}
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => setOpen(false)} disabled={busy}>
            Retour
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
