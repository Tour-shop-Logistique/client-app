import { useState } from 'react';
import { Ban, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import BottomSheet from '../common/BottomSheet';
import marketplaceService from '../../services/marketplaceService';

// Annulation d'une commande pas encore payee, par l'acheteur (`role="acheteur"`)
// ou le vendeur (`role="vendeur"`), motif optionnel. Sans declaration de
// paiement, la commande expire de toute facon apres 48 h.
export default function CancelOrderButton({ commandeId, role, onDone, handleError }) {
  const [open, setOpen] = useState(false);
  const [motif, setMotif] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (role === 'vendeur') await marketplaceService.annulerVente(commandeId, motif.trim());
      else await marketplaceService.annulerCommande(commandeId, motif.trim());
      toast.success('Commande annulée');
      setOpen(false);
      onDone?.();
    } catch (err) {
      handleError(err, 'Impossible d’annuler cette commande.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn-ghost w-full text-red-600" onClick={() => { setMotif(''); setOpen(true); }}>
        <Ban size={16} /> Annuler la commande
      </button>
      <BottomSheet open={open} onClose={() => !busy && setOpen(false)} title="Annuler la commande ?">
        <div className="space-y-3">
          <p className="text-sm text-surface-600">
            {role === 'vendeur'
              ? 'L’acheteur sera prévenu. N’annulez pas si vous avez déjà reçu son paiement.'
              : 'Le vendeur sera prévenu. N’annulez pas si vous avez déjà payé : contactez d’abord le vendeur.'}
          </p>
          <label className="block text-sm font-medium text-surface-700">
            Motif (optionnel)
            <textarea
              rows={2}
              maxLength={255}
              className="input-field mt-1.5"
              placeholder={role === 'vendeur' ? 'Ex : article plus disponible' : 'Ex : je ne souhaite plus cet article'}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
            />
          </label>
          <button type="button" className="btn w-full bg-red-600 text-white" onClick={submit} disabled={busy}>
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
