import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Camera, ChevronDown, MapPinned, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import StepProgress from '../../components/expedition/StepProgress';
import SuccessHero, { CopyReference } from '../../components/expedition/SuccessHero';
import EmptyState from '../../components/common/EmptyState';
import DraftRestoredBanner from '../../components/common/DraftRestoredBanner';
import useFormDraft from '../../hooks/useFormDraft';
import CountrySelectSheet from '../../components/common/CountrySelectSheet';
import AgencySelectSheet from '../../components/expedition/AgencySelectSheet';
import ContactFields from '../../components/expedition/ContactFields';
import PickupOption from '../../components/expedition/PickupOption';
import { ProofPicker } from '../../components/marketplace/FilePickers';
import {
  EMPTY_CONTACT, contactIsComplete, contactPayload, identityExpired, identityPayload,
} from '../../utils/contact';
import IdentityFields from '../../components/expedition/IdentityFields';
import { EMPTY_PICKUP, PICKUP_MODE_MESSAGE, pickupPayload } from '../../utils/pickup';
import { openAuthSheet } from '../../store/slices/uiSlice';
import expeditionService from '../../services/expeditionService';
import { getFlagEmoji } from '../../utils/countries';
import { formatPrice } from '../../utils/format';
import { ROUTES, expeditionDetailPath } from '../../routes';
import InvoiceDownloadButton from '../../components/invoice/InvoiceDownloadButton';
import ColisFormatFields from '../../components/expedition/ColisFormatFields';
import useColisFormats from '../../hooks/useColisFormats';
import { applyFormat, defaultFormat, overweight, syncColisFormats } from '../../utils/colisFormat';

const STEP_LABELS = ['Trajet', 'Colis', 'Devis', 'Coordonnees'];

const EMPTY_COLIS = { poids: '', longueur: '', largeur: '', hauteur: '', format_colis_id: '', prix_emballage: '', prix_estimation: '', photo: null };

// Builds the `colis[]` array shared by simulate-interville and store — only the
// fields the API expects, empty/zero optionals dropped. The optional photo is
// only sent to `store` (`withPhoto`), never to the JSON simulation.
// `prix_estimation` (valeur estimée du colis, FCFA) part à la simulation ET à
// l'enregistrement, toujours présent (0 si non renseigné) comme dans l'app agence.
const buildColis = (colisList, { withPhoto = false } = {}) =>
  colisList.map((c) => {
    const item = { poids: Number(c.poids), prix_estimation: Number(c.prix_estimation) || 0 };
    if (Number(c.longueur) > 0) item.longueur = Number(c.longueur);
    if (Number(c.largeur) > 0) item.largeur = Number(c.largeur);
    if (Number(c.hauteur) > 0) item.hauteur = Number(c.hauteur);
    if (c.format_colis_id) item.format_colis_id = c.format_colis_id;
    if (Number(c.prix_emballage) > 0) item.prix_emballage = Number(c.prix_emballage);
    if (withPhoto && c.photo) item.photo = c.photo;
    return item;
  });

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-surface-500">{label}</span>
      <span className={strong ? 'font-semibold text-primary-700' : 'font-medium text-surface-900'}>{value}</span>
    </div>
  );
}

function TarifCard({ status, error, sim, colisList = [], onRetry }) {
  if (status === 'loading') {
    return (
      <div className="rounded-xl border border-surface-100 bg-white px-4 py-3 text-sm text-surface-500">
        Calcul du tarif...
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="card border border-red-100 bg-red-50 p-3 text-sm text-red-700">
        {error}
        <button type="button" onClick={onRetry} className="mt-2 block font-semibold text-red-700 underline">
          Reessayer
        </button>
      </div>
    );
  }
  if (!sim?.tarif) return null;

  // Le montant de prestation est interne : le client ne voit que le total et
  // les frais d'emballage qu'il a saisis.
  const t = sim.tarif;
  const emballage = colisList.reduce((s, c) => s + (Number(c.prix_emballage) || 0), 0);
  return (
    <div className="card border border-primary-100 bg-primary-50/60 p-4">
      <p className="text-xs text-primary-700">Montant total de l'expedition</p>
      <p className="text-2xl font-bold text-primary-800">{formatPrice(t.montant_expedition)}</p>
      {emballage > 0 && (
        <div className="mt-2 flex justify-between text-xs text-primary-700/80">
          <span>Frais d'emballage</span>
          <span>{formatPrice(emballage)}</span>
        </div>
      )}
    </div>
  );
}

function SuccessScreen({ expedition, pickupMode, onNew }) {
  const navigate = useNavigate();
  return (
    <div>
      <TopBar title="Expedition Interville" />
      <div className="page-container space-y-4 py-4">
        <SuccessHero title="Demande enregistrée !" subtitle="En attente d'acceptation par l'agence de départ.">
          <CopyReference reference={expedition.reference} />
          <p className="mt-3 font-heading text-lg font-bold text-surface-900">{formatPrice(expedition.montant_expedition)}</p>
          {pickupMode && (
            <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-primary-700">
              {PICKUP_MODE_MESSAGE[pickupMode]}
            </p>
          )}
        </SuccessHero>

        <InvoiceDownloadButton expeditionId={expedition.id} />

        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => navigate(ROUTES.EXPEDITION_HISTORY)}>
            Mes expeditions
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => navigate(expeditionDetailPath(expedition.id))}
          >
            Voir le detail
          </button>
        </div>
        <button type="button" className="btn-ghost w-full" onClick={onNew}>
          Nouvelle expedition
        </button>
      </div>
    </div>
  );
}

// Interville shipment: one commune to another within the same country.
// Flow: communes + formats -> simulate-interville -> store.
// The devis is usable as a guest; login is only asked when confirming (store).
export default function IntervilleFormPage() {
  const dispatch = useDispatch();
  const country = useSelector((s) => s.country);
  const user = useSelector((s) => s.auth.user);
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);

  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [countrySheetOpen, setCountrySheetOpen] = useState(false);
  const [agenceSheetOpen, setAgenceSheetOpen] = useState(false);

  const [agence, setAgence] = useState(null);
  const [destinataireCommuneId, setDestinataireCommuneId] = useState('');
  const [colisList, setColisList] = useState([{ ...EMPTY_COLIS }]);
  const [expediteur, setExpediteur] = useState(EMPTY_CONTACT);
  const [destinataire, setDestinataire] = useState(EMPTY_CONTACT);
  const [pickup, setPickup] = useState(EMPTY_PICKUP);

  const [communes, setCommunes] = useState([]);
  const [communesStatus, setCommunesStatus] = useState('idle');
  const [sim, setSim] = useState(null);
  const [simStatus, setSimStatus] = useState('idle');
  const [simError, setSimError] = useState('');
  const [retryTick, setRetryTick] = useState(0);
  const { formats, status: formatsStatus } = useColisFormats(retryTick);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);

  // Saisie conservee si l'onglet est recharge (photos des colis comprises).
  // Un brouillon d'un autre pays est ignore.
  const draftData = useMemo(
    () => ({ code_pays: country.code, step, maxStepReached, agence, destinataireCommuneId, colisList, expediteur, destinataire, pickup }),
    [country.code, step, maxStepReached, agence, destinataireCommuneId, colisList, expediteur, destinataire, pickup]
  );
  const draftEmpty = !agence && !destinataireCommuneId && !colisList.some((c) => c.poids || c.photo) && !destinataire.nom_prenom;
  const draft = useFormDraft(
    'tourshop:expedition-interville',
    draftData,
    (d) => {
      if (d.code_pays !== country.code) return false;
      setStep(d.step ?? 1);
      setMaxStepReached(d.maxStepReached ?? 1);
      setAgence(d.agence ?? null);
      setDestinataireCommuneId(d.destinataireCommuneId ?? '');
      if (d.colisList?.length) setColisList(d.colisList);
      if (d.expediteur) setExpediteur(d.expediteur);
      if (d.destinataire) setDestinataire(d.destinataire);
      if (d.pickup) setPickup(d.pickup);
      return true;
    },
    draftEmpty
  );

  // Communes of the departure country — public, gives destinataire_commune_id.
  useEffect(() => {
    if (!country.code) return;
    let cancelled = false;
    setCommunesStatus('loading');
    expeditionService
      .listCommunes(country.code)
      .then((d) => {
        if (cancelled) return;
        setCommunes(d.communes ?? []);
        setCommunesStatus('idle');
      })
      .catch(() => !cancelled && setCommunesStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, country.code, retryTick]);

  // Formats de colis du backoffice : chaque colis reste aligné sur les formats
  // de l'API (format par défaut s'il n'en a pas, dimensions du format sinon).
  useEffect(() => {
    setColisList((cl) => syncColisFormats(cl, formats));
  }, [formats, colisList]);

  // Prefill the sender from the connected account (editable).
  useEffect(() => {
    if (!user) return;
    setExpediteur((e) =>
      e.nom_prenom || e.telephone
        ? e
        : {
            ...e,
            nom_prenom: [user.nom, user.prenoms].filter(Boolean).join(' '),
            telephone: user.telephone || '',
          }
    );
  }, [user]);

  const canSimulate =
    Boolean(agence?.id) &&
    Boolean(destinataireCommuneId) &&
    colisList.length > 0 &&
    colisList.every((c) => Number(c.poids) >= 0.01);

  // Simulate the tariff on the recap step (debounced, re-runs if inputs change).
  useEffect(() => {
    if (step < 3 || !canSimulate) return undefined;
    let cancelled = false;
    setSimStatus('loading');
    setSimError('');
    const timer = setTimeout(async () => {
      try {
        const res = await expeditionService.simulateInterville({
          agence_id: agence.id,
          type_expedition: 'interville',
          destinataire_commune_id: destinataireCommuneId,
          colis: buildColis(colisList),
        });
        if (cancelled) return;
        const data = res?.data;
        if (res?.success && data?.success) {
          setSim({ tarif: data.tarif, colis: data.colis ?? [] });
          setSimStatus('idle');
        } else {
          setSim(null);
          setSimError(res?.message || data?.message || 'Simulation impossible pour cette selection.');
          setSimStatus('error');
        }
      } catch (err) {
        if (cancelled) return;
        setSim(null);
        setSimError(
          err.response?.data?.message ||
            Object.values(err.response?.data?.errors || {}).flat().join(' ') ||
            'Impossible de simuler le tarif pour le moment.'
        );
        setSimStatus('error');
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step, canSimulate, agence, destinataireCommuneId, colisList, retryTick]);

  const goToStep = (n) => {
    setStep(n);
    setMaxStepReached((m) => Math.max(m, n));
  };

  const resetForm = () => {
    draft.clear();
    setStep(1);
    setMaxStepReached(1);
    setResult(null);
    setSubmitError('');
    setAgence(null);
    setDestinataireCommuneId('');
    setColisList([applyFormat({ ...EMPTY_COLIS }, defaultFormat(formats))]);
    setExpediteur({
      ...EMPTY_CONTACT,
      nom_prenom: [user?.nom, user?.prenoms].filter(Boolean).join(' '),
      telephone: user?.telephone || '',
    });
    setDestinataire(EMPTY_CONTACT);
    setPickup(EMPTY_PICKUP);
    setSim(null);
    setSimStatus('idle');
  };

  const addColis = () => {
    setColisList((list) => [...list, applyFormat({ ...EMPTY_COLIS }, defaultFormat(formats))]);
  };
  const removeColis = (i) => setColisList((list) => list.filter((_, idx) => idx !== i));
  const setColisField = (i, field, value) =>
    setColisList((list) => list.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));

  const communeNom = communes.find((c) => c.id === destinataireCommuneId)?.nom || '—';

  // The destinataire's ville is never typed: it always mirrors the commune
  // de destination picked on the Trajet step.
  useEffect(() => {
    if (communeNom === '—') return;
    setDestinataire((d) => (d.ville === communeNom ? d : { ...d, ville: communeNom }));
  }, [communeNom]);

  // Same for the expediteur: ville de depart = commune of the chosen agence.
  const agenceVille = agence?.commune || agence?.ville || '';
  useEffect(() => {
    if (!agenceVille) return;
    setExpediteur((e) => (e.ville === agenceVille ? e : { ...e, ville: agenceVille }));
  }, [agenceVille]);

  const canContinueStep1 = Boolean(agence?.id) && Boolean(destinataireCommuneId);
  const canContinueStep2 =
    colisList.length > 0 &&
    colisList.every((c) => Number(c.poids) >= 0.01 && !overweight(c, formats.find((f) => f.id === c.format_colis_id)));
  const canContinueStep3 = contactIsComplete(expediteur) && contactIsComplete(destinataire) && !identityExpired(expediteur);

  const handleSubmit = async () => {
    // The devis is open to guests; login is only required to register.
    if (!isAuthenticated) {
      dispatch(openAuthSheet({ mode: 'login', reason: 'expedition' }));
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        mode: 'interville',
        agence_id: agence.id,
        destinataire_commune_id: destinataireCommuneId,
        ...contactPayload('expediteur', expediteur),
        ...identityPayload(expediteur),
        ...contactPayload('destinataire', destinataire),
        colis: buildColis(colisList, { withPhoto: true }),
        ...pickupPayload(pickup),
      };
      const res = await expeditionService.storeExpedition(payload);
      if (res?.success && res.expedition) {
        draft.clear();
        setResult(res.expedition);
      } else {
        const msg = res?.message || "Impossible d'enregistrer la demande.";
        setSubmitError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        Object.values(err.response?.data?.errors || {}).flat().join(' ') ||
        "Impossible d'enregistrer l'expedition pour le moment.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) return <SuccessScreen expedition={result} pickupMode={pickup.domicile ? pickup.mode : null} onNew={resetForm} />;

  if (!country.code) {
    return (
      <div>
        <TopBar title="Expedition Interville" back />
        <div className="page-container py-4">
          <EmptyState
            icon={MapPinned}
            title="Choisissez votre pays"
            description="Selectionnez votre pays pour charger les communes et les agences."
            action={
              <button type="button" className="btn-primary" onClick={() => setCountrySheetOpen(true)}>
                Choisir un pays
              </button>
            }
          />
        </div>
        <CountrySelectSheet open={countrySheetOpen} onClose={() => setCountrySheetOpen(false)} currentCode={country.code} />
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Expedition Interville" back />
      <div className="page-container py-4">
        {draft.restored && <DraftRestoredBanner onReset={resetForm} className="mb-3" />}
        <StepProgress
          step={step}
          total={4}
          labels={STEP_LABELS}
          onStepClick={goToStep}
          maxStepReached={maxStepReached}
        />

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-surface-500">
              Depart depuis {getFlagEmoji(country.code)} {country.name}
            </p>

            <div>
              <p className="mb-1.5 text-sm font-medium text-surface-700">Agence de depart</p>
              <button
                type="button"
                onClick={() => setAgenceSheetOpen(true)}
                className="input-field flex items-center justify-between text-left"
              >
                <span className={agence ? 'text-surface-900' : 'text-surface-400'}>
                  {agence ? agence.nom_agence : 'Choisir une agence'}
                </span>
                <ChevronDown size={16} className="text-surface-400" />
              </button>
              <p className="mt-1 text-xs text-surface-400">
                La commune de depart est celle de l'agence choisie.
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-surface-700">Commune de destination</p>
              {communesStatus === 'loading' ? (
                <div className="input-field text-surface-400">Chargement des communes...</div>
              ) : communesStatus === 'error' ? (
                <button
                  type="button"
                  onClick={() => setRetryTick((t) => t + 1)}
                  className="input-field text-left text-red-600"
                >
                  Erreur de chargement — reessayer
                </button>
              ) : (
                <select
                  className="input-field"
                  value={destinataireCommuneId}
                  onChange={(e) => setDestinataireCommuneId(e.target.value)}
                >
                  <option value="">Choisir une commune</option>
                  {communes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button type="button" className="btn-primary w-full" disabled={!canContinueStep1} onClick={() => goToStep(2)}>
              Continuer
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {colisList.map((c, i) => (
              <div key={i} className="card space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-surface-900">Colis {i + 1}</p>
                  {colisList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeColis(i)}
                      className="rounded-full p-1.5 text-surface-400 hover:bg-surface-100 hover:text-red-600"
                      aria-label="Retirer ce colis"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <label className="block text-sm font-medium text-surface-700">
                  Poids (kg)
                  <input
                    type="number"
                    min="0.01"
                    step="0.1"
                    className="input-field mt-1.5"
                    value={c.poids}
                    onChange={(e) => setColisField(i, 'poids', e.target.value)}
                  />
                </label>

                <ColisFormatFields
                  colis={c}
                  formats={formats}
                  status={i === 0 ? formatsStatus : 'idle'}
                  onChange={(next) => setColisList((list) => list.map((x, idx) => (idx === i ? next : x)))}
                />

                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-medium text-surface-600">
                    Emballage (FCFA, optionnel)
                    <input type="number" inputMode="numeric" min="0" className="input-field mt-1.5" value={c.prix_emballage ?? ''} onChange={(e) => setColisField(i, 'prix_emballage', e.target.value)} />
                  </label>
                  <label className="block text-xs font-medium text-surface-600">
                    Estimation (FCFA)
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      placeholder="0"
                      className="input-field mt-1.5"
                      value={c.prix_estimation ?? ''}
                      onChange={(e) => setColisField(i, 'prix_estimation', e.target.value)}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                </div>
                <p className="-mt-1 text-[11px] text-surface-400">Estimation : valeur approximative du contenu du colis.</p>

                <ProofPicker
                  file={c.photo}
                  onChange={(f) => setColisField(i, 'photo', f)}
                  label="Photo du colis"
                  icon={Camera}
                  camera
                  removeLabel="Retirer la photo du colis"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={addColis}
              className="card flex w-full items-center justify-center gap-2 p-4 text-sm font-semibold text-primary-600"
            >
              <Plus size={18} /> Ajouter un colis
            </button>

            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => goToStep(1)}>Retour</button>
              <button type="button" className="btn-primary flex-1" disabled={!canContinueStep2} onClick={() => goToStep(3)}>Continuer</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="card divide-y divide-surface-100 p-4 text-sm">
              <Row label="Agence de depart" value={agence?.nom_agence} />
              <Row label="Commune d'arrivee" value={communeNom} />
              <Row label="Colis" value={`${colisList.length} colis`} />
            </div>

            <TarifCard
              status={simStatus}
              error={simError}
              sim={sim}
              colisList={colisList}
              onRetry={() => setRetryTick((t) => t + 1)}
            />

            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => goToStep(2)}>Retour</button>
              <button type="button" className="btn-primary flex-1" disabled={simStatus === 'loading' || !sim} onClick={() => goToStep(4)}>Continuer</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-surface-500">Qui expedie et qui reçoit ce colis ?</p>
            <ContactFields title="Expediteur" data={expediteur} onChange={setExpediteur} communes={communes} villeFixed={agenceVille || undefined}>
              <IdentityFields data={expediteur} onChange={setExpediteur} />
            </ContactFields>
            <ContactFields title="Destinataire" data={destinataire} onChange={setDestinataire} villeFixed={communeNom} withLocation locationLabel="Point de livraison" />
            <PickupOption
              value={pickup}
              onChange={setPickup}
              agence={agence}
              communeId={agence?.commune_id || communes.find((c) => c.nom === agenceVille)?.id}
              address={[expediteur.adresse, expediteur.quartier, expediteur.ville].filter((v) => v?.trim()).join(', ')}
            />

            {sim?.tarif && <TarifCard status={simStatus} error={simError} sim={sim} colisList={colisList} onRetry={() => setRetryTick((t) => t + 1)} />}

            {submitError && (
              <div className="card border border-red-100 bg-red-50 p-3 text-sm text-red-700">{submitError}</div>
            )}

            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => goToStep(3)}>Retour</button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={submitting || !canContinueStep3 || !sim}
                onClick={handleSubmit}
              >
                {submitting ? 'Envoi...' : "Confirmer l'expedition"}
              </button>
            </div>
          </div>
        )}
      </div>

      <AgencySelectSheet
        open={agenceSheetOpen}
        onClose={() => setAgenceSheetOpen(false)}
        codePays={country.code}
        currentId={agence?.id}
        onSelect={setAgence}
      />
    </div>
  );
}
