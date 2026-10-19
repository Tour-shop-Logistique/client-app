import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wallet, Copy, Check, Loader2, Receipt, RefreshCw, Smartphone, Landmark, Banknote, CreditCard, CircleDollarSign,
  AlertCircle, Bike,
} from 'lucide-react';
import { toast } from 'sonner';
import BottomSheet from '../common/BottomSheet';
import { ProofPicker } from '../marketplace/FilePickers';
import paymentService, {
  PAYMENT_METHODS, PAYMENT_OBJECTS, PROOF_STATUS, methodLabel, objectLabel,
} from '../../services/paymentService';
import destinataireService from '../../services/destinataireService';
import {
  formatDateTime, formatPrice, expeditionCurrency, currencyLabel,
} from '../../utils/format';
import { apiErrorMessage, storageUrl } from '../../utils/marketplace';

// Paiement à distance avec preuves (user-parcour/CHANGEMENTS_APPS_CLIENT_LIVREUR.md §3) :
//  1. le client voit le total à régler (`accounting_details.total_client_due`) ;
//  2. il paie HORS application sur un moyen de paiement de l'agence de départ ;
//  3. il dépose une preuve (capture / reçu), que l'agence confirme ou rejette —
//     en cas de rejet, `motif_rejet` est affiché pour corriger et redéposer.
// `viewer="destinataire"` : le destinataire règle les frais via
// /destinataire/preuves-paiement, et paie le livreur (`driverMission`) quand il
// a lui-même demandé la livraison (§4).

const METHOD_ICON = {
  mobile_money: Smartphone,
  bank_transfer: Landmark,
  cash: Banknote,
  card: CreditCard,
  other: CircleDollarSign,
};

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error('Copie impossible : notez le numéro manuellement.');
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-primary-50 px-2.5 text-xs font-semibold text-primary-700"
      aria-label={`Copier ${text}`}
    >
      {done ? <Check size={13} /> : <Copy size={13} />} {done ? 'Copié' : 'Copier'}
    </button>
  );
}

function AgencyMethods({ methods, selected, onSelect }) {
  if (methods === null) return <div className="h-14 skeleton rounded-xl" />;
  if (methods.length === 0) {
    return (
      <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
        L’agence n’a pas encore renseigné de moyen de paiement. Contactez-la pour connaître le numéro à utiliser.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {methods.map((m) => {
        const Icon = METHOD_ICON[m.methode] || CircleDollarSign;
        const active = selected === m.id;
        return (
          <li key={m.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(m)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(m); }}
              aria-pressed={active}
              className={`flex items-center gap-3 rounded-xl border p-3 transition ${active ? 'border-primary-600 bg-primary-50' : 'border-surface-200 bg-white'}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary-600 shadow-card">
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-surface-900">{m.libelle || methodLabel(m.methode)}</span>
                {m.numero_destinataire && (
                  <span className="block font-heading text-[15px] font-bold tracking-wide text-surface-800">{m.numero_destinataire}</span>
                )}
              </span>
              {m.numero_destinataire && <CopyButton text={m.numero_destinataire} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Formulaire de dépôt de preuve. `mode` : 'frais' (route générique) ou
// 'livreur' (payer-livreur du destinataire, sans objet de paiement).
function ProofForm({
  expedition, viewer, mode, mission, defaultAmount, currency, onDone, onCancel,
}) {
  const [methods, setMethods] = useState(null);
  const [methodId, setMethodId] = useState(null);
  const [objet, setObjet] = useState('tout_compris');
  const [montant, setMontant] = useState(defaultAmount != null ? String(defaultAmount) : '');
  const [methode, setMethode] = useState('mobile_money');
  const [reference, setReference] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const agenceId = expedition.agence_id ?? expedition.agence?.id;
  const forDriver = mode === 'livreur';

  // Moyens de l'agence de départ — inutiles pour payer le livreur en direct.
  useEffect(() => {
    if (forDriver || !agenceId) { setMethods([]); return undefined; }
    let alive = true;
    paymentService.agencyMethods(agenceId)
      .then((list) => { if (alive) setMethods(Array.isArray(list) ? list : []); })
      .catch(() => { if (alive) setMethods([]); });
    return () => { alive = false; };
  }, [agenceId, forDriver]);

  const pickMethod = (m) => {
    setMethodId(m.id);
    if (PAYMENT_METHODS.some((p) => p.value === m.methode)) setMethode(m.methode);
  };

  const amount = num(montant);
  const valid = amount != null && amount > 0 && Boolean(photo) && Boolean(methode);

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    const fields = {
      expeditionId: forDriver ? undefined : expedition.id,
      missionId: forDriver ? mission?.id : undefined,
      objet: forDriver ? undefined : objet,
      montant: amount,
      methode,
      reference,
      photo,
    };
    try {
      if (forDriver) await destinataireService.payDriver(fields);
      else if (viewer === 'destinataire') await destinataireService.submitProof(fields);
      else await paymentService.submitProof(fields);
      toast.success('Preuve de paiement envoyée', {
        description: forDriver ? 'Le paiement du livreur est enregistré.' : 'L’agence va la vérifier. Vous serez prévenu de sa décision.',
      });
      onDone();
    } catch (err) {
      setError(err.response?.status === 403
        ? 'Vous n’êtes pas autorisé à payer pour cette expédition.'
        : apiErrorMessage(err, 'Impossible d’envoyer la preuve pour le moment.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {!forDriver && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-surface-700">1. Payez sur un moyen de l’agence</p>
          <AgencyMethods methods={methods} selected={methodId} onSelect={pickMethod} />
        </div>
      )}
      {forDriver && (
        <p className="rounded-xl bg-surface-50 px-3 py-2.5 text-xs text-surface-600">
          Réglez la course directement au livreur (mobile money, espèces…), puis enregistrez ici la preuve du paiement.
        </p>
      )}

      <div className="space-y-3">
        {!forDriver && <p className="text-sm font-medium text-surface-700">2. Déposez la preuve</p>}

        {!forDriver && (
          <label className="block text-sm font-medium text-surface-700">
            Ce que vous réglez
            <select className="input-field mt-1.5" value={objet} onChange={(e) => setObjet(e.target.value)}>
              {PAYMENT_OBJECTS.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>)}
            </select>
          </label>
        )}

        <label className="block text-sm font-medium text-surface-700">
          Montant versé
          <div className="relative mt-1.5">
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              className="input-field pr-16"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="0"
              required
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-surface-400">
              {currencyLabel(currency || undefined)}
            </span>
          </div>
        </label>

        <label className="block text-sm font-medium text-surface-700">
          Moyen utilisé
          <select className="input-field mt-1.5" value={methode} onChange={(e) => setMethode(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>

        {methode !== 'cash' && (
          <label className="block text-sm font-medium text-surface-700">
            N° de transaction (optionnel)
            <input
              className="input-field mt-1.5"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex : PP240918.1423.A1"
              maxLength={100}
            />
          </label>
        )}

        <div>
          <p className="mb-1.5 text-sm font-medium text-surface-700">Capture ou reçu</p>
          <ProofPicker file={photo} onChange={setPhoto} label="Ajouter la preuve" camera optional={false} />
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={!valid || busy}>
        {busy && <Loader2 size={16} className="animate-spin" />} Envoyer la preuve
      </button>
      <button type="button" className="btn-ghost w-full" onClick={onCancel} disabled={busy}>
        Retour
      </button>
    </form>
  );
}

function ProofItem({ preuve, currency }) {
  const statut = PROOF_STATUS[preuve.statut] || { label: preuve.statut || '—', className: 'bg-surface-100 text-surface-600' };
  const photo = storageUrl(preuve.photo_path ?? preuve.photo_url ?? null);
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-surface-900">{formatPrice(preuve.montant, currency)}</p>
          <p className="text-xs text-surface-500">
            {[objectLabel(preuve.objet_paiement), methodLabel(preuve.methode_paiement), preuve.reference_transaction].filter(Boolean).join(' · ')}
          </p>
          {(preuve.created_at || preuve.confirme_le) && (
            <p className="text-xs text-surface-400">
              {preuve.statut !== 'en_attente' && preuve.confirme_le ? `Traitée le ${formatDateTime(preuve.confirme_le)}` : `Envoyée le ${formatDateTime(preuve.created_at)}`}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statut.className}`}>{statut.label}</span>
      </div>
      {preuve.statut === 'rejetee' && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          Motif du rejet : {preuve.motif_rejet || 'non précisé'}. Corrigez puis déposez une nouvelle preuve.
        </p>
      )}
      {photo && (
        <a href={photo} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary-600">
          <Receipt size={12} /> Voir la preuve
        </a>
      )}
    </li>
  );
}

export default function PaymentSection({
  expedition, viewer = 'client', refreshKey = 0, driverMission = null,
}) {
  const [proofs, setProofs] = useState(null);
  const [proofsError, setProofsError] = useState(false);
  const [sheet, setSheet] = useState(null); // 'frais' | 'livreur'

  const currency = expeditionCurrency(expedition);
  const total = num(expedition.accounting_details?.total_client_due) ?? num(expedition.montant_expedition);
  const paid = num(expedition.montant_paye) ?? 0;
  const remaining = total != null ? Math.max(0, total - paid) : null;
  const isPaid = expedition.statut_paiement === 'paye' || (remaining === 0 && total != null && total > 0);

  const load = useCallback(() => {
    setProofsError(false);
    paymentService.listProofs(expedition.id)
      .then((list) => setProofs(Array.isArray(list) ? list : []))
      .catch(() => { setProofs([]); setProofsError(true); });
  }, [expedition.id]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const pending = useMemo(() => (proofs ?? []).filter((p) => p.statut === 'en_attente'), [proofs]);
  const canPayDriver = viewer === 'destinataire' && driverMission && expedition.livraison_payee_par_destinataire;
  const driverPrice = num(driverMission?.montant_fixe ?? driverMission?.montant_final ?? driverMission?.montant);

  const done = () => {
    setSheet(null);
    load();
  };

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="icon-tile h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700"><Wallet size={17} /></span>
          <h2 className="font-heading text-[15px] font-semibold text-surface-900">Paiement</h2>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {isPaid ? 'Payé' : pending.length ? 'Preuve en vérification' : 'À régler'}
        </span>
      </div>

      {viewer === 'client' && total != null && (
        <dl className="divide-y divide-surface-100 rounded-xl bg-surface-50 px-3 text-sm">
          <div className="flex justify-between py-2">
            <dt className="text-surface-500">Total à régler</dt>
            <dd className="font-semibold text-surface-900">{formatPrice(total, currency)}</dd>
          </div>
          {paid > 0 && (
            <div className="flex justify-between py-2">
              <dt className="text-surface-500">Déjà payé</dt>
              <dd className="font-medium text-emerald-700">{formatPrice(paid, currency)}</dd>
            </div>
          )}
          {!isPaid && remaining != null && paid > 0 && (
            <div className="flex justify-between py-2">
              <dt className="text-surface-500">Reste à payer</dt>
              <dd className="font-bold text-surface-900">{formatPrice(remaining, currency)}</dd>
            </div>
          )}
        </dl>
      )}
      {viewer === 'client' && total != null && (
        <p className="mt-2 text-xs text-surface-500">
          Inclut le prix de base, la prestation, l’emballage, l’enlèvement / la livraison à domicile et les éventuels frais annexes.
        </p>
      )}

      {proofs && proofs.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">Mes preuves de paiement</p>
          <ul className="divide-y divide-surface-100">
            {proofs.map((p) => <ProofItem key={p.id} preuve={p} currency={currency} />)}
          </ul>
        </div>
      )}
      {proofsError && viewer === 'client' && (
        <button type="button" onClick={load} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600">
          <RefreshCw size={14} /> Historique des preuves indisponible, réessayer
        </button>
      )}

      <div className="mt-4 space-y-2">
        {canPayDriver && (
          <button type="button" className="btn-primary w-full" onClick={() => setSheet('livreur')}>
            <Bike size={16} /> Payer le livreur{driverPrice != null ? ` · ${formatPrice(driverPrice, driverMission?.devise)}` : ''}
          </button>
        )}
        {!isPaid && (
          <button type="button" className={canPayDriver ? 'btn-secondary w-full' : 'btn-primary w-full'} onClick={() => setSheet('frais')}>
            <Receipt size={16} /> {proofs?.some((p) => p.statut === 'rejetee') ? 'Déposer une nouvelle preuve' : 'Payer et déposer une preuve'}
          </button>
        )}
      </div>

      <BottomSheet
        open={Boolean(sheet)}
        onClose={() => setSheet(null)}
        title={sheet === 'livreur' ? 'Payer le livreur' : 'Payer l’expédition'}
      >
        {sheet && (
          <ProofForm
            key={sheet}
            expedition={expedition}
            viewer={viewer}
            mode={sheet}
            mission={driverMission}
            currency={sheet === 'livreur' ? driverMission?.devise : currency}
            defaultAmount={sheet === 'livreur' ? driverPrice : (viewer === 'client' ? remaining : null)}
            onDone={done}
            onCancel={() => setSheet(null)}
          />
        )}
      </BottomSheet>
    </section>
  );
}
