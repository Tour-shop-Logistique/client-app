import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Smartphone, Banknote, Landmark, CreditCard, Wallet, Trash2, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import BottomSheet from '../../components/common/BottomSheet';
import AbonnementBanner from '../../components/marketplace/AbonnementBanner';
import useMarketplaceError from '../../hooks/useMarketplaceError';
import marketplaceService from '../../services/marketplaceService';
import { PAYMENT_METHODS } from '../../utils/marketplace';

const METHOD_ICONS = { mobile_money: Smartphone, cash: Banknote, bank_transfer: Landmark, card: CreditCard, other: Wallet };
const OPERATORS = ['Orange Money', 'MTN MoMo', 'Wave', 'Moov Money'];
const METHOD_ORDER = ['mobile_money', 'cash', 'bank_transfer', 'other'];

function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
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

const EMPTY_FORM = { methode: 'mobile_money', libelle: 'Orange Money', numeroDestinataire: '' };

// Moyens de paiement du vendeur (section 3), valables pour toutes ses annonces.
export default function PaymentMethodsPage() {
  const handleError = useMarketplaceError();
  const [moyens, setMoyens] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    marketplaceService
      .mesMoyensPaiement()
      .then(setMoyens)
      .catch((err) => {
        setMoyens([]);
        handleError(err, 'Impossible de charger vos moyens de paiement.');
      });
  }, [handleError]);

  useEffect(() => {
    load();
  }, [load]);

  const needsNumber = form.methode === 'mobile_money' || form.methode === 'bank_transfer';

  const add = async () => {
    setSaving(true);
    try {
      const created = await marketplaceService.ajouterMoyenPaiement(form);
      setMoyens((list) => [...(list ?? []), created]);
      toast.success('Moyen de paiement ajouté');
      setSheet(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      handleError(err, 'Ajout impossible.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (m, actif) => {
    setBusyId(m.id);
    setMoyens((list) => list.map((x) => (x.id === m.id ? { ...x, actif } : x)));
    try {
      await marketplaceService.modifierMoyenPaiement(m.id, { actif });
    } catch (err) {
      setMoyens((list) => list.map((x) => (x.id === m.id ? { ...x, actif: !actif } : x)));
      handleError(err, 'Modification impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Supprimer « ${m.libelle || PAYMENT_METHODS[m.methode]} » ?`)) return;
    setBusyId(m.id);
    try {
      await marketplaceService.supprimerMoyenPaiement(m.id);
      setMoyens((list) => list.filter((x) => x.id !== m.id));
      toast.success('Moyen de paiement supprimé');
    } catch (err) {
      handleError(err, 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <TopBar title="Moyens de paiement" back />
      <div className="page-container space-y-4 py-4">
        <AbonnementBanner />
        <div className="flex gap-2.5 rounded-2xl bg-primary-50 p-3.5 text-caption text-primary-900">
          <Info size={16} className="mt-0.5 shrink-0" />
          Vos acheteurs vous paient directement avec ces moyens. Ils s’appliquent à toutes vos annonces.
        </div>

        {moyens === null && (
          <div className="space-y-2">
            <div className="h-20 skeleton rounded-2xl shadow-card" />
            <div className="h-20 skeleton rounded-2xl shadow-card" />
          </div>
        )}

        <motion.ul layout className="space-y-2.5">
          <AnimatePresence initial={false}>
            {moyens?.map((m) => {
              const Icon = METHOD_ICONS[m.methode] ?? Wallet;
              return (
                <motion.li
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  className={`flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card transition ${m.actif ? '' : 'opacity-60'}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-shop-100 text-shop-800">
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold text-surface-900">{m.libelle || PAYMENT_METHODS[m.methode]}</p>
                    <p className="truncate text-caption text-surface-500">
                      {m.numero_destinataire ? <span className="font-mono">{m.numero_destinataire}</span> : PAYMENT_METHODS[m.methode]}
                    </p>
                  </div>
                  <Switch checked={Boolean(m.actif)} disabled={busyId === m.id} onChange={(v) => toggle(m, v)} />
                  <button
                    type="button"
                    onClick={() => remove(m)}
                    disabled={busyId === m.id}
                    className="rounded-full p-2 text-surface-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>

        {moyens?.length === 0 && (
          <p className="text-center text-body text-surface-500">Aucun moyen de paiement. Ajoutez-en au moins un pour être payé.</p>
        )}

        <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => setSheet(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-shop-300 bg-shop-50 py-4 text-body font-semibold text-shop-800 transition hover:bg-shop-100">
          <Plus size={18} /> Ajouter un moyen de paiement
        </motion.button>
      </div>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Nouveau moyen de paiement">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {METHOD_ORDER.map((key) => {
              const Icon = METHOD_ICONS[key];
              const active = form.methode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, methode: key, libelle: key === 'mobile_money' ? 'Orange Money' : PAYMENT_METHODS[key] }))}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-caption font-semibold transition ${
                    active ? 'border-shop-400 bg-shop-50 text-shop-900' : 'border-surface-100 text-surface-600'
                  }`}
                >
                  <Icon size={20} /> {PAYMENT_METHODS[key]}
                </button>
              );
            })}
          </div>

          {form.methode === 'mobile_money' && (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {OPERATORS.map((op) => (
                <button key={op} type="button" onClick={() => setForm((f) => ({ ...f, libelle: op }))} className={`chip ${form.libelle === op ? 'chip-active' : ''}`}>
                  {op}
                </button>
              ))}
            </div>
          )}

          <label className="block text-caption font-medium text-surface-600">
            Libellé
            <input className="input-field mt-1" maxLength={255} value={form.libelle} onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))} />
          </label>

          {needsNumber && (
            <label className="block text-caption font-medium text-surface-600">
              {form.methode === 'mobile_money' ? 'Numéro qui reçoit les paiements' : 'Numéro de compte'}
              <input
                className="input-field mt-1 font-mono"
                inputMode={form.methode === 'mobile_money' ? 'tel' : 'text'}
                maxLength={50}
                placeholder={form.methode === 'mobile_money' ? '07 00 00 00 00' : 'IBAN / RIB'}
                value={form.numeroDestinataire}
                onChange={(e) => setForm((f) => ({ ...f, numeroDestinataire: e.target.value }))}
              />
            </label>
          )}

          <button type="button" className="btn-shop w-full" disabled={saving || (needsNumber && !form.numeroDestinataire.trim())} onClick={add}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Ajouter
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
