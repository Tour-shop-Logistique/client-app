import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  AlertTriangle, Building2, Camera, Check, ChevronDown, MapPin, MapPinned, Plus, Search, Trash2,
} from 'lucide-react';
import {
  ContactSummary, ErrorNote, PickerButton, RouteRail, SummaryRow as Row,
} from '../../components/expedition/FlowParts';
import { fmtKg } from '../../utils/decimal';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import BottomSheet from '../../components/common/BottomSheet';
import StepBar from '../../components/expedition/StepBar';
import ActionDock, { DockTotal } from '../../components/expedition/ActionDock';
import WeightStepper from '../../components/expedition/WeightStepper';
import CommuneSelectSheet from '../../components/expedition/CommuneSelectSheet';
import SuccessHero, { CopyReference } from '../../components/expedition/SuccessHero';
import EmptyState from '../../components/common/EmptyState';
import DraftRestoredBanner from '../../components/common/DraftRestoredBanner';
import useFormDraft from '../../hooks/useFormDraft';
import useExitGuard from '../../hooks/useExitGuard';
import ExitFlowSheet from '../../components/expedition/ExitFlowSheet';
import CountrySelectSheet from '../../components/common/CountrySelectSheet';
import AgencySelectSheet from '../../components/expedition/AgencySelectSheet';
import ContactFields from '../../components/expedition/ContactFields';
import PickupOption from '../../components/expedition/PickupOption';
import FeeBreakdown from '../../components/expedition/FeeBreakdown';
import { ProofPicker } from '../../components/marketplace/FilePickers';
import {
  EMPTY_CONTACT, contactIsComplete, contactPayload, identityExpired, identityPayload,
} from '../../utils/contact';
import IdentityFields from '../../components/expedition/IdentityFields';
import { EMPTY_PICKUP, PICKUP_MODE_MESSAGE, pickupPayload } from '../../utils/pickup';
import { openAuthSheet } from '../../store/slices/uiSlice';
import expeditionService from '../../services/expeditionService';
import { getFlagEmoji } from '../../utils/countries';
import { formatPrice, formatExpeditionPrice, currencyLabel } from '../../utils/format';
import { ROUTES, expeditionDetailPath } from '../../routes';
import InvoiceDownloadButton from '../../components/invoice/InvoiceDownloadButton';
import ColisFormatFields from '../../components/expedition/ColisFormatFields';
import useColisFormats from '../../hooks/useColisFormats';
import { applyFormat, defaultFormat, overweight, syncColisFormats } from '../../utils/colisFormat';
import { getRecentCommunes, pushRecentCommune } from '../../utils/recentCommunes';

// Parcours mobile en 3 étapes : Trajet -> Colis -> Coordonnées, puis une feuille
// de vérification avant l'enregistrement. Le tarif (simulate-interville) n'est
// plus une étape : il s'affiche en continu dans la barre d'action dès que
// l'agence, la commune et des colis valides sont connus.
const STEP_LABELS = ['Trajet', 'Colis', 'Coordonnées'];
const LAST_STEP = STEP_LABELS.length;

// Pas de montant d'emballage en Interville : ni saisi, ni envoyé.
const EMPTY_COLIS = { poids: '', longueur: '', largeur: '', hauteur: '', format_colis_id: '', prix_estimation: '', photo: null };

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
    if (withPhoto && c.photo) item.photo = c.photo;
    return item;
  });

const dimsOf = (c) => {
  const d = [c.longueur, c.largeur, c.hauteur].map((v) => Number(v) || 0);
  return d.every((v) => v > 0) ? `${d.join('×')} cm` : null;
};

function SuccessScreen({ expedition, pickupMode, pickupEstimate, onNew }) {
  const navigate = useNavigate();
  return (
    <div>
      <TopBar title="Envoi Interville" />
      <div className="page-container space-y-4 py-4">
        <SuccessHero title="Demande enregistrée !" subtitle="En attente d'acceptation par l'agence de départ.">
          <CopyReference reference={expedition.reference} />
          <p className="mt-3 font-heading text-lg font-bold text-surface-900">{formatExpeditionPrice(expedition.montant_expedition, expedition)}</p>
          {pickupMode && (
            <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-primary-700">
              {PICKUP_MODE_MESSAGE[pickupMode]}
              {pickupEstimate?.total != null && <> Montant de l’enlèvement : <strong>{formatPrice(pickupEstimate.total)}</strong>.</>}
            </p>
          )}
        </SuccessHero>

        <InvoiceDownloadButton expeditionId={expedition.id} />

        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => navigate(ROUTES.EXPEDITION_HISTORY)}>
            Mes expéditions
          </button>
          <button type="button" className="btn-primary flex-1" onClick={() => navigate(expeditionDetailPath(expedition.id))}>
            Voir le détail
          </button>
        </div>
        <button type="button" className="btn-ghost w-full" onClick={onNew}>
          Nouvel envoi
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
  const [communeSheetOpen, setCommuneSheetOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [openColis, setOpenColis] = useState(0);
  const [expediteurOpen, setExpediteurOpen] = useState(true);

  const [agence, setAgence] = useState(null);
  const [destinataireCommuneId, setDestinataireCommuneId] = useState('');
  const [colisList, setColisList] = useState([{ ...EMPTY_COLIS }]);
  const [expediteur, setExpediteur] = useState(EMPTY_CONTACT);
  const [destinataire, setDestinataire] = useState(EMPTY_CONTACT);
  const [pickup, setPickup] = useState(EMPTY_PICKUP);

  const [communes, setCommunes] = useState([]);
  const [communesStatus, setCommunesStatus] = useState('idle');
  const [recentIds, setRecentIds] = useState(() => getRecentCommunes(country.code));
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
      // Les brouillons de l'ancien parcours (4 étapes) reprennent à la dernière.
      setStep(Math.min(d.step ?? 1, LAST_STEP));
      setMaxStepReached(Math.min(d.maxStepReached ?? 1, LAST_STEP));
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

  useEffect(() => {
    setRecentIds(getRecentCommunes(country.code));
  }, [country.code]);

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

  const formatOf = (c) => formats.find((f) => f.id === c.format_colis_id) || null;
  const colisIsValid = (c) => Number(c.poids) >= 0.01 && !overweight(c, formatOf(c));

  // Agence sans commune configurée : le store renverrait « Aucune commune n'est
  // associée à votre agence. » On ne bloque que si l'API l'indique clairement.
  const agenceSansCommune = Boolean(agence) && 'commune_id' in agence && !agence.commune_id;
  const trajetOk = Boolean(agence?.id) && !agenceSansCommune && Boolean(destinataireCommuneId);
  const colisOk = colisList.length > 0 && colisList.every(colisIsValid);
  const canSimulate = trajetOk && colisOk;

  // Tarif en continu dès l'étape Colis (debounce, relancé si la saisie change,
  // pas à chaque changement d'étape).
  const simActive = step >= 2;
  useEffect(() => {
    if (!simActive) return undefined;
    if (!canSimulate) {
      setSim(null);
      setSimStatus('idle');
      setSimError('');
      return undefined;
    }
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
          setSimError(res?.message || data?.message || 'Simulation impossible pour cette sélection.');
          setSimStatus('error');
        }
      } catch (err) {
        if (cancelled) return;
        setSim(null);
        setSimError(
          err.response?.data?.message ||
            Object.values(err.response?.data?.errors || {}).flat().join(' ') ||
            'Impossible de calculer le tarif pour le moment.'
        );
        setSimStatus('error');
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [simActive, canSimulate, agence, destinataireCommuneId, colisList, retryTick]);

  const goToStep = (n) => {
    // À l'arrivée sur les coordonnées, un expéditeur déjà complet (prérempli
    // depuis le compte) reste replié ; on l'ouvre s'il manque quelque chose.
    if (n === 3) setExpediteurOpen(!(contactIsComplete(expediteur) && !identityExpired(expediteur)));
    setStep(n);
    setMaxStepReached((m) => Math.max(m, n));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    draft.clear();
    setStep(1);
    setMaxStepReached(1);
    setResult(null);
    setSubmitError('');
    setRecapOpen(false);
    setAgence(null);
    setDestinataireCommuneId('');
    setColisList([applyFormat({ ...EMPTY_COLIS }, defaultFormat(formats))]);
    setOpenColis(0);
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
    setOpenColis(colisList.length);
  };
  const removeColis = (i) => {
    setColisList((list) => list.filter((_, idx) => idx !== i));
    setOpenColis(Math.max(0, i - 1));
  };
  const setColisField = (i, field, value) =>
    setColisList((list) => list.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  const replaceColis = (i, next) => setColisList((list) => list.map((c, idx) => (idx === i ? next : c)));

  const commune = communes.find((c) => c.id === destinataireCommuneId) || null;
  const communeNom = commune?.nom || '';
  const recentCommunes = recentIds.map((id) => communes.find((c) => c.id === id)).filter(Boolean);

  const selectCommune = (c) => {
    setDestinataireCommuneId(c.id);
    setRecentIds(pushRecentCommune(country.code, c.id));
  };

  // The destinataire's ville is never typed: it always mirrors the commune
  // de destination picked on the Trajet step.
  useEffect(() => {
    if (!communeNom) return;
    setDestinataire((d) => (d.ville === communeNom ? d : { ...d, ville: communeNom }));
  }, [communeNom]);

  // Same for the expediteur: ville de depart = commune of the chosen agence.
  const agenceVille = agence?.commune || agence?.ville || '';
  useEffect(() => {
    if (!agenceVille) return;
    setExpediteur((e) => (e.ville === agenceVille ? e : { ...e, ville: agenceVille }));
  }, [agenceVille]);

  const expediteurOk = contactIsComplete(expediteur) && !identityExpired(expediteur);
  const contactsOk = expediteurOk && contactIsComplete(destinataire);
  const poidsTotal = colisList.reduce((s, c) => s + (Number(c.poids) || 0), 0);
  const total = sim?.tarif?.montant_expedition;
  const totalLabel = total != null ? formatPrice(total) : null;

  const handleSubmit = async () => {
    // The devis is open to guests; login is only required to register.
    if (!isAuthenticated) {
      setRecapOpen(false);
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
        // Interville : pas de position ni d'instructions pour le destinataire
        // (seul le point d'enlèvement de l'expéditeur est demandé). Retirées
        // aussi d'un éventuel brouillon saisi avant ce changement.
        ...contactPayload('destinataire', { ...destinataire, latitude: null, longitude: null, instructions: '' }),
        colis: buildColis(colisList, { withPhoto: true }),
        ...pickupPayload(pickup),
      };
      const res = await expeditionService.storeExpedition(payload);
      if (res?.success && res.expedition) {
        draft.clear();
        setRecapOpen(false);
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
        "Impossible d'enregistrer l'expédition pour le moment.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Retour (flèche de l'en-tête ou bouton système) : revient d'une étape ; à la
  // première, demande confirmation avant de quitter si une saisie existe. Une
  // feuille ouverte est fermée avant (pile des feuilles, useExitGuard).
  const dirty = !draftEmpty;
  const handleBack = () => {
    if (step > 1) {
      goToStep(step - 1);
      return;
    }
    if (dirty) exit.requestExit();
    else exit.leave();
  };
  const exit = useExitGuard({ active: dirty && !result, onBack: handleBack, fallback: ROUTES.EXPEDITION_NEW });

  if (result) return <SuccessScreen expedition={result} pickupMode={pickup.domicile ? pickup.mode : null} pickupEstimate={pickup.domicile ? pickup.estimate : null} onNew={resetForm} />;

  if (!country.code) {
    return (
      <div>
        <TopBar title="Envoi Interville" back />
        <div className="page-container py-4">
          <EmptyState
            icon={MapPinned}
            title="Choisissez votre pays"
            description="Sélectionnez votre pays pour charger les communes et les agences."
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
      <TopBar
        title="Envoi Interville"
        subtitle={`${getFlagEmoji(country.code)} ${country.name}`}
        back
        onBack={handleBack}
        backLabel={step > 1 ? 'Étape précédente' : "Quitter l'envoi"}
      />
      <div className="page-container pb-2 pt-1">
        {draft.restored && <DraftRestoredBanner onReset={resetForm} className="mb-3" />}
        <StepBar step={step} labels={STEP_LABELS} maxStepReached={maxStepReached} onStepClick={goToStep} />

        {/* ---------- Étape 1 : Trajet ---------- */}
        {step === 1 && (
          <>
            <div className="space-y-4">
              <h2 className="font-heading text-lg font-semibold text-surface-900">D'où part le colis, et où va-t-il ?</h2>

              <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3">
                <RouteRail />

                <div className="space-y-4">
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-surface-700">Départ · agence</p>
                    <PickerButton
                      icon={Building2}
                      selected={Boolean(agence)}
                      title={agence ? agence.nom_agence : 'Choisir une agence'}
                      subtitle={agence ? `Commune : ${agenceVille || '—'}` : 'Où vous déposez le colis'}
                      onClick={() => setAgenceSheetOpen(true)}
                    />
                  </div>

                  <div>
                    <p className="mb-1.5 text-sm font-medium text-surface-700">Arrivée · commune</p>
                    {communesStatus === 'error' ? (
                      <button
                        type="button"
                        onClick={() => setRetryTick((t) => t + 1)}
                        className="flex h-16 w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3 text-left text-sm font-medium text-red-700"
                      >
                        <AlertTriangle size={18} className="shrink-0" /> Communes indisponibles · Réessayer
                      </button>
                    ) : (
                      <PickerButton
                        icon={MapPin}
                        trailing={Search}
                        selected={Boolean(commune)}
                        title={commune ? commune.nom : communesStatus === 'loading' ? 'Chargement des communes…' : 'Choisir une commune'}
                        subtitle={commune ? 'Commune du destinataire' : 'Rechercher par nom'}
                        onClick={() => setCommuneSheetOpen(true)}
                      />
                    )}
                  </div>
                </div>
              </div>

              {recentCommunes.length > 0 && (
                <div>
                  <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-surface-500">Destinations récentes</p>
                  <div className="flex flex-wrap gap-2">
                    {recentCommunes.map((c) => {
                      const active = c.id === destinataireCommuneId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => selectCommune(c)}
                          className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-95 ${
                            active ? 'bg-primary-600 text-white' : 'bg-white text-surface-700 ring-1 ring-surface-200'
                          }`}
                        >
                          {active && <Check size={14} strokeWidth={3} />} {c.nom}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {agenceSansCommune ? (
                <ErrorNote message="Cette agence n'a pas de commune configurée : l'envoi Interville n'est pas possible depuis elle. Choisissez une autre agence." />
              ) : (
                <p className="flex items-start gap-2 rounded-xl bg-primary-50 p-3 text-caption text-primary-800">
                  <MapPinned size={15} className="mt-0.5 shrink-0" />
                  La commune de départ est celle de l'agence choisie : vous n'avez pas à la saisir.
                </p>
              )}
            </div>

            <ActionDock>
              <button type="button" className="btn-primary h-12 flex-1" disabled={!trajetOk} onClick={() => goToStep(2)}>
                Continuer
              </button>
            </ActionDock>
          </>
        )}

        {/* ---------- Étape 2 : Colis ---------- */}
        {step === 2 && (
          <>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-heading text-lg font-semibold text-surface-900">Vos colis</h2>
                <p className="shrink-0 text-caption text-surface-500">
                  {agenceVille || agence?.nom_agence} → {communeNom}
                </p>
              </div>

              {colisList.map((c, i) => {
                const open = openColis === i;
                const format = formatOf(c);
                const valid = colisIsValid(c);
                const summary = [
                  Number(c.poids) > 0 ? fmtKg(c.poids) : 'Poids à indiquer',
                  dimsOf(c),
                  c.photo ? 'photo' : null,
                ].filter(Boolean).join(' · ');

                return (
                  <div key={i} className="card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenColis(open ? -1 : i)}
                      aria-expanded={open}
                      className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          valid ? 'bg-emerald-600 text-white' : 'bg-surface-100 text-surface-500'
                        }`}
                      >
                        {valid ? <Check size={15} strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-surface-900">
                          Colis {i + 1}{format ? ` · ${format.nom}` : ''}
                        </span>
                        <span className={`block truncate text-caption ${valid ? 'text-surface-500' : 'text-amber-700'}`}>{summary}</span>
                      </span>
                      <ChevronDown size={18} className={`shrink-0 text-surface-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>

                    {open && (
                      <div className="space-y-4 border-t border-surface-100 px-4 pb-4 pt-3">
                        <WeightStepper id={`colis-${i}-poids`} value={c.poids} onChange={(v) => setColisField(i, 'poids', v)} />

                        <ColisFormatFields
                          colis={c}
                          formats={formats}
                          status={formatsStatus}
                          idPrefix={`colis-${i}`}
                          onChange={(next) => replaceColis(i, next)}
                        />

                        <label htmlFor={`colis-${i}-valeur`} className="block text-sm font-medium text-surface-700">
                          Valeur du contenu ({currencyLabel()}, optionnel)
                          <input
                            id={`colis-${i}-valeur`}
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="0"
                            className="input-field mt-1.5"
                            value={c.prix_estimation ?? ''}
                            onChange={(e) => setColisField(i, 'prix_estimation', e.target.value.replace(/\D/g, ''))}
                            onFocus={(e) => e.target.select()}
                          />
                          <span className="mt-1 block text-caption font-normal text-surface-400">Valeur approximative de ce qu'il y a dans le colis.</span>
                        </label>

                        <ProofPicker
                          file={c.photo}
                          onChange={(f) => setColisField(i, 'photo', f)}
                          label="Photo du colis (optionnel)"
                          icon={Camera}
                          camera
                          removeLabel="Retirer la photo du colis"
                        />

                        {colisList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeColis(i)}
                            className="btn w-full text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={16} /> Retirer ce colis
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addColis}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary-200 text-sm font-semibold text-primary-600 transition active:scale-[0.99]"
              >
                <Plus size={18} /> Ajouter un colis
              </button>

              {simStatus === 'error' && <ErrorNote message={simError} onRetry={() => setRetryTick((t) => t + 1)} />}
            </div>

            <ActionDock>
              <DockTotal
                label={`Tarif · ${colisList.length} colis`}
                amount={totalLabel}
                status={simStatus}
              />
              <button
                type="button"
                className="btn-primary h-12 flex-1"
                disabled={!colisOk || !sim || simStatus === 'loading'}
                onClick={() => goToStep(3)}
              >
                Continuer
              </button>
            </ActionDock>
          </>
        )}

        {/* ---------- Étape 3 : Coordonnées ---------- */}
        {step === 3 && (
          <>
            <div className="space-y-3">
              <h2 className="font-heading text-lg font-semibold text-surface-900">Qui envoie, qui reçoit ?</h2>

              {expediteurOpen ? (
                <div className="space-y-2">
                  <ContactFields title="Expéditeur" data={expediteur} onChange={setExpediteur} communes={communes} villeFixed={agenceVille || undefined}>
                    <IdentityFields data={expediteur} onChange={setExpediteur} />
                  </ContactFields>
                  {expediteurOk && (
                    <button type="button" className="btn-ghost w-full" onClick={() => setExpediteurOpen(false)}>
                      <Check size={16} /> Valider l'expéditeur
                    </button>
                  )}
                </div>
              ) : (
                <ContactSummary title="Expéditeur" data={expediteur} onEdit={() => setExpediteurOpen(true)} />
              )}

              <ContactFields title="Destinataire" data={destinataire} onChange={setDestinataire} villeFixed={communeNom} />

              <PickupOption
                value={pickup}
                onChange={setPickup}
                agence={agence}
                communeId={agence?.commune_id || communes.find((c) => c.nom === agenceVille)?.id}
                address={[expediteur.adresse, expediteur.quartier, expediteur.ville].filter((v) => v?.trim()).join(', ')}
              />

              {simStatus === 'error' && <ErrorNote message={simError} onRetry={() => setRetryTick((t) => t + 1)} />}
              {!contactsOk && (
                <p className="text-caption text-surface-500">
                  Nom, téléphone et adresse sont requis pour l'expéditeur et le destinataire.
                </p>
              )}
            </div>

            <ActionDock>
              <DockTotal label="Total" amount={totalLabel} status={simStatus} />
              <button
                type="button"
                className="btn-primary h-12 flex-1"
                disabled={!contactsOk || !sim || simStatus === 'loading'}
                onClick={() => {
                  setSubmitError('');
                  setRecapOpen(true);
                }}
              >
                Vérifier ma demande
              </button>
            </ActionDock>
          </>
        )}
      </div>

      {/* ---------- Vérification avant envoi ---------- */}
      <BottomSheet open={recapOpen} onClose={() => !submitting && setRecapOpen(false)} title="Vérifiez votre demande">
        <div className="space-y-4">
          <div className="divide-y divide-surface-100 rounded-xl border border-surface-100 px-3 text-sm">
            <Row label="Trajet" value={`${agenceVille || '—'} → ${communeNom || '—'}`} />
            <Row label="Agence de départ" value={agence?.nom_agence} />
            <Row label="Colis" value={`${colisList.length} · ${fmtKg(poidsTotal)}`} />
            <Row label="Expéditeur" value={expediteur.nom_prenom} />
            <Row label="Destinataire" value={`${destinataire.nom_prenom} · ${destinataire.telephone}`} />
            <Row
              label="Remise"
              value={pickup.domicile ? `Enlèvement à domicile (${pickup.mode === 'groupage' ? 'retrait classique' : 'récupération express'})` : "Dépôt à l'agence"}
            />
            {pickup.domicile && (
              <Row
                label="Enlèvement (estimé)"
                value={pickup.estimate?.total != null ? formatPrice(pickup.estimate.total) : 'Confirmé par l’agence'}
              />
            )}
          </div>

          <div className="rounded-2xl bg-primary-50 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-primary-700">{pickup.domicile ? 'Montant de l’envoi' : 'Montant total'}</span>
              <span className="font-heading text-2xl font-bold text-primary-800">{totalLabel}</span>
            </div>
            {pickup.domicile && pickup.estimate?.total != null && total != null && (
              <p className="mt-1 text-right text-caption text-primary-700">
                + enlèvement {formatPrice(pickup.estimate.total)} · total à prévoir {formatPrice(Number(total) + Number(pickup.estimate.total))}
              </p>
            )}
          </div>
          {pickup.domicile && <FeeBreakdown detail={pickup.estimate} />}

          <p className="text-caption text-surface-500">
            {pickup.domicile && "L'enlèvement est facturé en plus de l'envoi ; son montant est confirmé à l'enregistrement. "}
            L'agence de départ doit accepter votre demande avant de la traiter.
          </p>

          {submitError && <ErrorNote message={submitError} />}

          <div className="space-y-2">
            <button type="button" className="btn-primary h-12 w-full" disabled={submitting || !sim} onClick={handleSubmit}>
              {submitting ? 'Envoi…' : isAuthenticated ? `Confirmer · ${totalLabel}` : 'Se connecter pour confirmer'}
            </button>
            <button type="button" className="btn-secondary w-full" disabled={submitting} onClick={() => setRecapOpen(false)}>
              Modifier
            </button>
          </div>
        </div>
      </BottomSheet>

      <ExitFlowSheet
        open={exit.confirmOpen}
        progress={`Étape ${step} sur ${LAST_STEP} · ${STEP_LABELS[step - 1]}`}
        amount={totalLabel}
        onStay={exit.stay}
        onKeep={exit.leave}
        onDiscard={() => {
          draft.clear();
          exit.leave();
        }}
      />
      <AgencySelectSheet
        open={agenceSheetOpen}
        onClose={() => setAgenceSheetOpen(false)}
        codePays={country.code}
        currentId={agence?.id}
        onSelect={setAgence}
      />
      <CommuneSelectSheet
        open={communeSheetOpen}
        onClose={() => setCommuneSheetOpen(false)}
        communes={communes}
        status={communesStatus}
        onRetry={() => setRetryTick((t) => t + 1)}
        currentId={destinataireCommuneId}
        recent={recentCommunes}
        onSelect={selectCommune}
      />
    </div>
  );
}
