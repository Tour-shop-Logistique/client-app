import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Check, ChevronDown, MapPinned, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import StepProgress from '../../components/expedition/StepProgress';
import EmptyState from '../../components/common/EmptyState';
import CountrySelectSheet from '../../components/common/CountrySelectSheet';
import AgencySelectSheet from '../../components/expedition/AgencySelectSheet';
import ContactFields from '../../components/expedition/ContactFields';
import { EMPTY_CONTACT, contactIsComplete, contactPayload } from '../../utils/contact';
import { openAuthSheet } from '../../store/slices/uiSlice';
import expeditionService from '../../services/expeditionService';
import { getFlagEmoji } from '../../utils/countries';
import { formatPrice } from '../../utils/format';
import { ROUTES, expeditionDetailPath } from '../../routes';

const STEP_LABELS = ['Trajet', 'Colis', 'Devis', 'Coordonnees'];

const EMPTY_COLIS = { poids: '', longueur: '', largeur: '', hauteur: '', format_colis_id: '', prix_emballage: '' };

const formatHint = (f) => (f.poids_max != null ? `jusqu'a ${f.poids_max} kg` : 'poids libre');

// Builds the `colis[]` array shared by simulate-interville and store — only the
// fields the API expects, empty/zero optionals dropped.
const buildColis = (colisList) =>
  colisList.map((c) => {
    const item = { poids: Number(c.poids) };
    if (Number(c.longueur) > 0) item.longueur = Number(c.longueur);
    if (Number(c.largeur) > 0) item.largeur = Number(c.largeur);
    if (Number(c.hauteur) > 0) item.hauteur = Number(c.hauteur);
    if (c.format_colis_id) item.format_colis_id = c.format_colis_id;
    if (Number(c.prix_emballage) > 0) item.prix_emballage = Number(c.prix_emballage);
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

function TarifCard({ status, error, sim, onRetry }) {
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

  const t = sim.tarif;
  return (
    <div className="card border border-primary-100 bg-primary-50/60 p-4">
      <p className="text-xs text-primary-700">Montant de l'expedition</p>
      <p className="text-2xl font-bold text-primary-800">{formatPrice(t.montant_expedition)}</p>
      <div className="mt-2 space-y-0.5 text-xs text-primary-700/80">
        <div className="flex justify-between">
          <span>Transport</span>
          <span>{formatPrice(t.montant_base)}</span>
        </div>
        {Number(t.montant_prestation) > 0 && (
          <div className="flex justify-between">
            <span>Prestation ({t.pourcentage_prestation}%)</span>
            <span>{formatPrice(t.montant_prestation)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SuccessScreen({ expedition, onNew }) {
  const navigate = useNavigate();
  return (
    <div>
      <TopBar title="Expedition Interville" />
      <div className="page-container space-y-4 py-4">
        <div className="card flex flex-col items-center gap-2 border border-primary-100 bg-primary-50/60 p-6 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white">
            <Check size={28} />
          </span>
          <p className="text-base font-bold text-surface-900">Demande enregistree avec succes.</p>
          <p className="text-sm text-surface-500">
            Reference <span className="font-semibold text-surface-900">{expedition.reference}</span>
          </p>
          <p className="text-lg font-bold text-primary-700">{formatPrice(expedition.montant_expedition)}</p>
          <p className="text-xs text-surface-400">
            En attente d'acceptation par l'agence de depart.
          </p>
        </div>

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

  const [communes, setCommunes] = useState([]);
  const [communesStatus, setCommunesStatus] = useState('idle');
  const [formats, setFormats] = useState([]);
  const [formatsStatus, setFormatsStatus] = useState('idle');

  const [sim, setSim] = useState(null);
  const [simStatus, setSimStatus] = useState('idle');
  const [simError, setSimError] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);

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

  // Colis formats of the client's backoffice — default-select the is_default one.
  useEffect(() => {
    if (!country.code) return;
    let cancelled = false;
    setFormatsStatus('loading');
    expeditionService
      .getColisFormats()
      .then((d) => {
        if (cancelled) return;
        const list = d.formats ?? [];
        setFormats(list);
        setFormatsStatus('idle');
        const def = list.find((f) => f.is_default) || list[0];
        if (def) {
          setColisList((cl) => cl.map((c) => (c.format_colis_id ? c : { ...c, format_colis_id: def.id })));
        }
      })
      .catch(() => !cancelled && setFormatsStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, country.code, retryTick]);

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
    setStep(1);
    setMaxStepReached(1);
    setResult(null);
    setSubmitError('');
    setAgence(null);
    setDestinataireCommuneId('');
    const def = formats.find((f) => f.is_default) || formats[0];
    setColisList([{ ...EMPTY_COLIS, format_colis_id: def?.id || '' }]);
    setExpediteur({
      ...EMPTY_CONTACT,
      nom_prenom: [user?.nom, user?.prenoms].filter(Boolean).join(' '),
      telephone: user?.telephone || '',
    });
    setDestinataire(EMPTY_CONTACT);
    setSim(null);
    setSimStatus('idle');
  };

  const addColis = () => {
    const def = formats.find((f) => f.is_default) || formats[0];
    setColisList((list) => [...list, { ...EMPTY_COLIS, format_colis_id: def?.id || '' }]);
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
  const canContinueStep2 = colisList.length > 0 && colisList.every((c) => Number(c.poids) >= 0.01);
  const canContinueStep3 = contactIsComplete(expediteur) && contactIsComplete(destinataire);

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
        ...contactPayload('destinataire', destinataire),
        colis: buildColis(colisList),
      };
      const res = await expeditionService.storeExpedition(payload);
      if (res?.success && res.expedition) {
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

  if (result) return <SuccessScreen expedition={result} onNew={resetForm} />;

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
            {formatsStatus === 'loading' && (
              <p className="text-xs text-surface-400">Chargement des formats de colis...</p>
            )}
            {formatsStatus === 'error' && (
              <p className="text-xs text-amber-600">
                Formats indisponibles — le format par defaut de l'agence sera applique.
              </p>
            )}
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

                {formats.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-surface-700">Format</p>
                    <div className="grid grid-cols-3 gap-2">
                      {formats.map((f) => {
                        const selected = c.format_colis_id === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setColisField(i, 'format_colis_id', f.id)}
                            className={`rounded-xl border p-2.5 text-left text-xs transition ${
                              selected ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-surface-200 text-surface-600'
                            }`}
                          >
                            <span className="block text-sm font-semibold">{f.nom}</span>
                            <span className="text-[11px] text-surface-500">{formatHint(f)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <label className="block text-xs font-medium text-surface-600">
                    Longueur (cm)
                    <input type="number" min="0" className="input-field mt-1.5" value={c.longueur} onChange={(e) => setColisField(i, 'longueur', e.target.value)} />
                  </label>
                  <label className="block text-xs font-medium text-surface-600">
                    Largeur (cm)
                    <input type="number" min="0" className="input-field mt-1.5" value={c.largeur} onChange={(e) => setColisField(i, 'largeur', e.target.value)} />
                  </label>
                  <label className="block text-xs font-medium text-surface-600">
                    Hauteur (cm)
                    <input type="number" min="0" className="input-field mt-1.5" value={c.hauteur} onChange={(e) => setColisField(i, 'hauteur', e.target.value)} />
                  </label>
                </div>

                <label className="block text-xs font-medium text-surface-600">
                  Emballage (FCFA, optionnel)
                  <input type="number" min="0" className="input-field mt-1.5" value={c.prix_emballage} onChange={(e) => setColisField(i, 'prix_emballage', e.target.value)} />
                </label>
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
            <ContactFields title="Expediteur" data={expediteur} onChange={setExpediteur} communes={communes} villeFixed={agenceVille || undefined} />
            <ContactFields title="Destinataire" data={destinataire} onChange={setDestinataire} villeFixed={communeNom} />

            {sim?.tarif && <TarifCard status={simStatus} error={simError} sim={sim} onRetry={() => setRetryTick((t) => t + 1)} />}

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
