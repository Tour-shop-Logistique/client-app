import { useState } from 'react';
import { Home, Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import BottomSheet from '../common/BottomSheet';
import HomeMissionFields from './HomeMissionFields';
import expeditionService from '../../services/expeditionService';
import destinataireService from '../../services/destinataireService';
import { missionRequestPayload } from '../../utils/pickup';
import { expeditionCurrency } from '../../utils/format';
import { arrivalAgence } from '../../utils/expedition';

// Demande d'enlèvement ou de livraison à domicile APRÈS la création de
// l'expédition (api-enlevement-livraison-client.md) :
//  - POST /expedition/client/{id}/demander-enlevement (chez l'expéditeur,
//    depuis l'agence de départ) — seul moyen en mode `recuperation_agence` ;
//  - POST /expedition/client/{id}/demander-livraison (chez le destinataire,
//    depuis l'agence d'arrivée) ;
//  - `viewer="destinataire"` : POST /destinataire/{id}/demander-livraison — le
//    destinataire demande lui-même la livraison et PAIE le livreur
//    (user-parcour/CHANGEMENTS_APPS_CLIENT_LIVREUR.md §4).
// Express : prix imposé (standard × taux express), affiché avant confirmation.
// 422 si le taux express n'est pas configuré : on propose le mode standard.
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
  destinataire: {
    icon: Home,
    cta: 'Me faire livrer à domicile',
    hint: 'Un livreur apporte le colis de l’agence jusque chez vous. Vous réglez la course au livreur.',
    title: 'Livraison à domicile',
    submit: 'Confirmer la livraison',
  },
};

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

const errorMessage = (err) => {
  const data = err.response?.data;
  return data?.message || Object.values(data?.errors || {}).flat()[0] || 'Impossible d’envoyer la demande pour le moment.';
};

export default function MissionRequest({ expedition, kind, onDone, viewer = 'client' }) {
  const asRecipient = viewer === 'destinataire';
  const copy = asRecipient ? COPY.destinataire : COPY[kind];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(() => initialValue(expedition, kind));
  const [expressRefused, setExpressRefused] = useState(null); // message 422 express

  const agence = kind === 'enlevement' ? expedition.agence : arrivalAgence(expedition);
  const communeId = kind === 'enlevement'
    ? expedition.agence?.commune_id
    : agence?.commune_id ?? expedition.destinataire_commune_id;
  // Enlèvement : grille de la commune de départ (devise d'origine). Livraison :
  // commune d'arrivée — devise de destination si fournie, sinon celle de l'utilisateur.
  const currency = kind === 'enlevement' ? expeditionCurrency(expedition) : expedition.devise_destination ?? undefined;

  const openSheet = () => {
    setValue(initialValue(expedition, kind));
    setExpressRefused(null);
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    setExpressRefused(null);
    try {
      const payload = missionRequestPayload(value);
      let res;
      if (asRecipient) res = await destinataireService.requestDelivery(expedition.id, payload);
      else if (kind === 'enlevement') res = await expeditionService.requestPickup(expedition.id, payload);
      else res = await expeditionService.requestHomeDelivery(expedition.id, payload);
      toast.success(res?.message || 'Demande envoyée.', {
        description: value.mode === 'express'
          ? 'Course diffusée aux livreurs disponibles : le premier qui l’accepte la prend en charge.'
          : 'TourShop affecte un livreur au tarif fixé par l’agence.',
      });
      setOpen(false);
      onDone?.(res);
    } catch (err) {
      const message = errorMessage(err);
      // Express non configuré pour la tranche : repli proposé sur le standard.
      if (err.response?.status === 422 && value.mode === 'express' && /express/i.test(message)) {
        setExpressRefused(message);
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const switchToStandard = () => {
    setValue((v) => ({ ...v, mode: 'groupage' }));
    setExpressRefused(null);
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
          <HomeMissionFields
            value={value}
            onChange={setValue}
            agence={agence}
            communeId={communeId}
            kind={kind}
            currency={currency}
          />
          {pointMissing && (
            <p className="text-xs text-amber-700">
              Sans position, le livreur n’aura que l’adresse écrite pour se repérer.
            </p>
          )}
          {expressRefused && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>{expressRefused}</p>
              <button type="button" className="btn-secondary w-full" onClick={switchToStandard}>
                Passer en mode classique
              </button>
            </div>
          )}
          {asRecipient && (
            <p className="rounded-xl bg-surface-50 px-3 py-2.5 text-xs text-surface-600">
              Vous payez le livreur directement (mobile money, espèces…), puis vous déposez la preuve de paiement dans l’app.
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
