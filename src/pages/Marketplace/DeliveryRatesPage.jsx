import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus, Route, Trash2, Loader2, Info, Pencil, MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import BottomSheet from '../../components/common/BottomSheet';
import AbonnementBanner from '../../components/marketplace/AbonnementBanner';
import useMarketplaceError from '../../hooks/useMarketplaceError';
import useCommunes from '../../hooks/useCommunes';
import marketplaceService from '../../services/marketplaceService';
import { formatMoney } from '../../utils/marketplace';
import { currencyLabel } from '../../utils/format';

// Tarifs du livreur du vendeur, par commune de destination
// (MARKETPLACE_LIVRAISON_3_MODES.md, "gérer ses tarifs de livraison").
// Sans tarif vers la commune de l'acheteur, le mode « livreur du vendeur »
// ne lui est pas propose. POST = upsert par commune.

function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-surface-300'} disabled:opacity-50`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 32 }}
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow ${checked ? 'right-1' : 'left-1'}`}
      />
    </button>
  );
}

const communeName = (tarif, communes) => tarif.commune_destination?.nom
  ?? communes.find((c) => String(c.id) === String(tarif.commune_destination_id))?.nom
  ?? 'Commune';

export default function DeliveryRatesPage() {
  const handleError = useMarketplaceError();
  const { communes, status: communesStatus } = useCommunes();
  const [tarifs, setTarifs] = useState(null);
  const [sheet, setSheet] = useState(null); // null | { id?, communeId, montant }
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    marketplaceService
      .mesTarifsLivraison()
      .then(setTarifs)
      .catch((err) => {
        setTarifs([]);
        handleError(err, 'Impossible de charger vos tarifs de livraison.');
      });
  }, [handleError]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(
    () => [...(tarifs ?? [])].sort((a, b) => communeName(a, communes).localeCompare(communeName(b, communes))),
    [tarifs, communes],
  );

  const openAdd = () => setSheet({ communeId: '', montant: '' });
  const openEdit = (t) => setSheet({ id: t.id, communeId: t.commune_destination_id, montant: String(t.montant ?? '') });

  const montant = Number(sheet?.montant);
  const valid = Boolean(sheet?.communeId) && sheet?.montant !== '' && Number.isFinite(montant) && montant >= 0;
  // Commune deja tarifee : l'ajout la met a jour (upsert cote serveur).
  const existing = sheet && !sheet.id ? (tarifs ?? []).find((t) => String(t.commune_destination_id) === String(sheet.communeId)) : null;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      if (sheet.id) await marketplaceService.modifierTarifLivraison(sheet.id, { montant });
      else await marketplaceService.enregistrerTarifLivraison({ communeDestinationId: sheet.communeId, montant });
      toast.success(sheet.id || existing ? 'Tarif mis à jour' : 'Tarif ajouté');
      setSheet(null);
      load();
    } catch (err) {
      handleError(err, 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (t, actif) => {
    setBusyId(t.id);
    setTarifs((list) => list.map((x) => (x.id === t.id ? { ...x, actif } : x)));
    try {
      await marketplaceService.modifierTarifLivraison(t.id, { actif });
    } catch (err) {
      setTarifs((list) => list.map((x) => (x.id === t.id ? { ...x, actif: !actif } : x)));
      handleError(err, 'Modification impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Supprimer le tarif vers ${communeName(t, communes)} ?`)) return;
    setBusyId(t.id);
    try {
      await marketplaceService.supprimerTarifLivraison(t.id);
      setTarifs((list) => list.filter((x) => x.id !== t.id));
      toast.success('Tarif supprimé');
    } catch (err) {
      handleError(err, 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <TopBar title="Tarifs de livraison" subtitle="Votre livreur, par commune" back />
      <div className="page-container space-y-4 py-4">
        <AbonnementBanner />

        <div className="flex gap-2.5 rounded-2xl bg-primary-50 p-3.5 text-caption text-primary-900">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>
            Vous avez votre propre livreur ? Fixez son tarif vers chaque commune : l’acheteur qui y habite pourra choisir
            « Livreur du vendeur » à côté des livraisons standard et express de TourShop. Sans tarif, cette option ne lui est pas proposée.
          </p>
        </div>

        {tarifs === null && (
          <div className="space-y-2">
            <div className="h-16 skeleton rounded-2xl" />
            <div className="h-16 skeleton rounded-2xl" />
          </div>
        )}

        {tarifs?.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-10 text-center shadow-card">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Route size={26} />
            </span>
            <div>
              <p className="font-heading text-base font-semibold text-surface-900">Aucun tarif pour l’instant</p>
              <p className="mt-1 text-sm text-surface-500">Vos acheteurs ne verront que les livraisons standard et express.</p>
            </div>
            <button type="button" className="btn-shop" onClick={openAdd}>
              <Plus size={16} /> Ajouter un tarif
            </button>
          </div>
        )}

        {sorted.length > 0 && (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {sorted.map((t) => {
                const actif = t.actif !== false;
                return (
                  <motion.li
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-card ${actif ? '' : 'opacity-60'}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                      <MapPin size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-semibold text-surface-900">{communeName(t, communes)}</p>
                      <p className="font-heading text-body font-bold text-surface-900">{formatMoney(t.montant)}</p>
                    </div>
                    <button type="button" onClick={() => openEdit(t)} className="rounded-full p-2 text-surface-500 hover:bg-surface-100" aria-label={`Modifier le tarif vers ${communeName(t, communes)}`}>
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => remove(t)} disabled={busyId === t.id} className="rounded-full p-2 text-surface-400 hover:bg-red-50 hover:text-red-600" aria-label={`Supprimer le tarif vers ${communeName(t, communes)}`}>
                      {busyId === t.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                    <Switch checked={actif} onChange={(v) => toggle(t, v)} disabled={busyId === t.id} label={`Tarif vers ${communeName(t, communes)} ${actif ? 'actif' : 'inactif'}`} />
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        {sorted.length > 0 && (
          <button type="button" className="btn-secondary w-full" onClick={openAdd}>
            <Plus size={16} /> Ajouter une commune
          </button>
        )}
      </div>

      <BottomSheet open={Boolean(sheet)} onClose={() => !saving && setSheet(null)} title={sheet?.id ? 'Modifier le tarif' : 'Nouveau tarif'}>
        {sheet && (
          <div className="space-y-4">
            <label className="block" htmlFor="tarif-commune">
              <span className="text-caption font-medium text-surface-600">Commune de livraison</span>
              <select
                id="tarif-commune"
                className="input-field mt-1"
                value={sheet.communeId ?? ''}
                onChange={(e) => setSheet((s) => ({ ...s, communeId: e.target.value }))}
                disabled={Boolean(sheet.id) || communesStatus === 'loading'}
              >
                <option value="">{communesStatus === 'loading' ? 'Chargement des communes…' : 'Choisir une commune'}</option>
                {communes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              {existing && (
                <span className="mt-1 block text-caption text-amber-700">
                  Vous avez déjà un tarif vers cette commune ({formatMoney(existing.montant)}) : il sera remplacé.
                </span>
              )}
            </label>
            <label className="block" htmlFor="tarif-montant">
              <span className="text-caption font-medium text-surface-600">Prix de la livraison ({currencyLabel()})</span>
              <input
                id="tarif-montant"
                type="number"
                inputMode="numeric"
                min="0"
                className="input-field mt-1"
                placeholder="2000"
                value={sheet.montant}
                onChange={(e) => setSheet((s) => ({ ...s, montant: e.target.value }))}
              />
            </label>
            <button type="button" className="btn-shop w-full" disabled={!valid || saving} onClick={save}>
              {saving && <Loader2 size={16} className="animate-spin" />} Enregistrer
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
