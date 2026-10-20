import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  AlertTriangle, Boxes, Building2, Camera, Check, ChevronDown, Globe2, Home, MapPinned, Plus, RotateCcw, Search, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import BottomSheet from '../../components/common/BottomSheet';
import StepBar from '../../components/expedition/StepBar';
import ActionDock, { DockTotal } from '../../components/expedition/ActionDock';
import WeightStepper from '../../components/expedition/WeightStepper';
import {
  ContactSummary, ErrorNote, PickerButton, RouteRail, SummaryRow as Row,
} from '../../components/expedition/FlowParts';
import SuccessHero, { CopyReference } from '../../components/expedition/SuccessHero';
import EmptyState from '../../components/common/EmptyState';
import DraftRestoredBanner from '../../components/common/DraftRestoredBanner';
import useFormDraft from '../../hooks/useFormDraft';
import useExitGuard from '../../hooks/useExitGuard';
import ExitFlowSheet from '../../components/expedition/ExitFlowSheet';
import EmptyParcelAnimation from '../../components/illustrations/EmptyParcelAnimation';
import CountrySelectSheet from '../../components/common/CountrySelectSheet';
import CitySelectSheet from '../../components/common/CitySelectSheet';
import AgencySelectSheet from '../../components/expedition/AgencySelectSheet';
import ProductSelectSheet from '../../components/expedition/ProductSelectSheet';
import DestinationCountrySheet from '../../components/expedition/DestinationCountrySheet';
import PickupOption from '../../components/expedition/PickupOption';
import FeeBreakdown from '../../components/expedition/FeeBreakdown';
import { EMPTY_PICKUP, PICKUP_MODE_MESSAGE, pickupPayload } from '../../utils/pickup';
import { ProofPicker } from '../../components/marketplace/FilePickers';
import useRequireAuth from '../../hooks/useRequireAuth';
import expeditionService from '../../services/expeditionService';
import produitService from '../../services/produitService';
import cityService from '../../services/cityService';
import { getCountryName, getFlagEmoji } from '../../utils/countries';
import { isDestinationCompatible, destinationBadges } from '../../utils/expedition';
import { isAfricanCountry } from '../../utils/africa';
import { formatPrice } from '../../utils/format';
import { decimalClean, decimalDisplay, fmtKg } from '../../utils/decimal';
import { ROUTES, expeditionDetailPath } from '../../routes';
import InvoiceDownloadButton from '../../components/invoice/InvoiceDownloadButton';
import IdentityFields from '../../components/expedition/IdentityFields';
import {
  EMPTY_CONTACT, contactIsComplete, contactPayload, identityExpired, identityPayload,
} from '../../utils/contact';
import ContactFields from '../../components/expedition/ContactFields';

// Parcours mobile en 3 étapes : Trajet (mode, destination, agence) -> Colis ou
// Articles -> Coordonnées, puis une feuille de vérification avant `store`.
// L'agence est choisie dès le Trajet : le devis (POST /devis) peut donc tourner
// pendant la saisie des colis, et l'estimation reste visible dans la barre du bas.

const DRAFT_VERSION = 2;
const EMPTY_LD_COLIS = { poids: '', longueur: '', largeur: '', hauteur: '', articles: [], photo: null };

const MODES = [
  {
    value: 'livraison_domicile',
    icon: Home,
    label: 'À domicile',
    hint: 'Livré chez le destinataire. Tarif par colis, selon le poids et les dimensions.',
  },
  {
    value: 'recuperation_agence',
    icon: Building2,
    label: 'En agence',
    hint: "Retiré en agence à l'arrivée. Tarif par produit, regroupé par catégorie.",
  },
];

const TYPE_LABELS = {
  groupage_dhd_aerien: 'DHD Aérien',
  groupage_dhd_maritime: 'DHD Maritime',
  groupage_afrique: 'Groupage Afrique',
  groupage_ca: 'Groupage CA',
  simple: 'Livraison à domicile',
};

function typeLabel(type) {
  return TYPE_LABELS[type] || String(type || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Booleen Laravel, parfois serialise en 1 / "1".
const isEligibleLd = (p) => p?.eligible_ld === true || p?.eligible_ld === 1 || p?.eligible_ld === '1';

// Brouillons de l'ancien parcours en 6 étapes (Mode, Destination, Colis, Agence,
// Coordonnées, Récap) : ramenés sur les 3 nouvelles étapes.
const migrateStep = (s) => {
  if (s >= 5) return 3;
  if (s === 3) return 2;
  return 1;
};

// Shared with the groupage selector below so the estimate in the action bar
// always matches what each category's choice shows.
function computeEstimateTotal(mode, devis, typesChoisis) {
  if (mode === 'livraison_domicile') return devis?.montant_expedition ?? null;
  if (!Array.isArray(devis) || devis.length === 0) return null;
  const shippable = devis.filter((g) => g.types_eligibles.length > 0);
  if (shippable.length === 0) return null;
  return shippable.reduce((sum, g) => {
    const chosen = g.types_eligibles.find((t) => t.type_expedition === typesChoisis[g.category_id]);
    if (chosen) return sum + chosen.montant_expedition;
    return sum + Math.min(...g.types_eligibles.map((t) => t.montant_expedition));
  }, 0);
}

const dimsOf = (c) => {
  const d = [c.longueur, c.largeur, c.hauteur].map((v) => Number(v) || 0);
  return d.every((v) => v > 0) ? `${d.join('×')} cm` : null;
};

// Choix du type d'expédition d'une catégorie (groupage), en cartes à choix unique.
function GroupTypeChoice({ group, chosen, onSelect }) {
  const types = group.types_eligibles;
  return (
    <div className="card space-y-2.5 p-4">
      <div className="flex items-center gap-3">
        <span className="icon-tile h-10 w-10 rounded-xl bg-shop-100 text-shop-700">
          <Boxes size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-surface-900">{group.category_nom}</p>
          <p className="text-caption text-surface-500">Poids du groupe : {fmtKg(group.poids_total)}</p>
        </div>
      </div>

      {types.length === 0 ? (
        <p className="rounded-xl bg-amber-50 p-3 text-caption text-amber-800">
          Aucun tarif pour cette catégorie vers cette destination : elle ne sera pas envoyée.
        </p>
      ) : (
        <div className="space-y-2" role="radiogroup" aria-label={`Mode d'expédition : ${group.category_nom}`}>
          {types.length > 1 && <p className="text-caption text-surface-500">Choisissez le mode d'expédition :</p>}
          {types.map((t) => {
            const selected = chosen === t.type_expedition;
            const cheapest = types.length > 1 && t.montant_expedition === Math.min(...types.map((x) => x.montant_expedition));
            return (
              <button
                key={t.type_expedition}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSelect(group.category_id, t.type_expedition)}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition active:scale-[0.99] ${
                  selected ? 'border-primary-600 bg-primary-50' : 'border-surface-200 bg-white'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected ? 'border-primary-600' : 'border-surface-300'
                  }`}
                >
                  {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary-600" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${selected ? 'text-primary-800' : 'text-surface-900'}`}>
                    {typeLabel(t.type_expedition)}
                  </span>
                  {types.length === 1 && <span className="block text-caption text-surface-500">Seul mode disponible</span>}
                  {cheapest && <span className="block text-caption text-teal-700">Le moins cher</span>}
                </span>
                <span className="shrink-0 font-heading text-sm font-bold text-surface-900">{formatPrice(t.montant_expedition)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Résultat de `store`. Livraison à domicile : une expédition. Récupération en
// agence : 201 (succès total/partiel) ou 422 (aucune créée), toujours avec
// `resultats[]` par catégorie — chaque échec porte son `message`.
function SubmitResultScreen({ result, pickupMode, pickupEstimate, categoryNames = {}, onNewExpedition, onBack, onRetryFailed }) {
  const navigate = useNavigate();
  const isGroupage = Array.isArray(result.resultats);
  const successes = isGroupage
    ? result.resultats.filter((r) => r.success)
    : result.expedition ? [{ expedition: result.expedition }] : [];
  const failures = isGroupage ? result.resultats.filter((r) => !r.success) : [];
  const partial = successes.length > 0 && failures.length > 0;

  return (
    <div>
      <TopBar title="Envoi international" />
      <div className="page-container space-y-4 py-4">
        {successes.length > 0 ? (
          <SuccessHero
            title={partial ? 'Envoi en partie enregistré' : 'Demande enregistrée !'}
            subtitle={
              partial
                ? `${successes.length} sur ${successes.length + failures.length} catégories enregistrées. L'agence va examiner votre demande.`
                : "En attente d'acceptation par l'agence de départ."
            }
          >
            {successes.length === 1 && !partial && <CopyReference reference={successes[0].expedition.reference} />}
            {pickupMode && (
              <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-primary-700">
                {PICKUP_MODE_MESSAGE[pickupMode]}
                {pickupEstimate?.total != null && <> Montant de l’enlèvement : <strong>{formatPrice(pickupEstimate.total)}</strong>.</>}
              </p>
            )}
          </SuccessHero>
        ) : (
          <div className="card flex items-start gap-3 p-4">
            <span className="icon-tile h-10 w-10 rounded-xl bg-red-50 text-red-600">
              <AlertTriangle size={18} />
            </span>
            <div>
              <p className="font-semibold text-surface-900">{result.message || "Aucune demande n'a pu être enregistrée."}</p>
              <p className="mt-0.5 text-caption text-surface-500">Votre saisie est conservée : modifiez-la puis renvoyez.</p>
            </div>
          </div>
        )}

        {isGroupage && (
          <div className="space-y-2">
            {successes.map(({ category_id: catId, expedition: exp }) => (
              <button
                key={exp.id}
                type="button"
                onClick={() => navigate(expeditionDetailPath(exp.id))}
                className="card flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check size={15} strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-surface-900">{categoryNames[catId] || typeLabel(exp.type_expedition)}</span>
                  <span className="block truncate text-caption text-surface-500">
                    {typeLabel(exp.type_expedition)} · <span className="font-mono">{exp.reference}</span>
                  </span>
                </span>
                <span className="shrink-0 font-heading text-sm font-bold text-primary-700">{formatPrice(exp.montant_expedition)}</span>
              </button>
            ))}
            {failures.map((f, i) => (
              <div key={f.category_id || i} className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
                  <X size={15} strokeWidth={3} />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{categoryNames[f.category_id] || 'Catégorie'} · non enregistrée</p>
                  <p className="text-caption">{f.message || "Cette catégorie n'a pas pu être enregistrée."}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {successes.map(({ expedition: exp }) => (
          <InvoiceDownloadButton
            key={`facture-${exp.id}`}
            expeditionId={exp.id}
            label={successes.length > 1 ? `Facture ${exp.reference}` : 'Télécharger la facture'}
          />
        ))}

        {successes.length === 0 ? (
          <button type="button" className="btn-primary h-12 w-full" onClick={onBack}>
            Revenir au formulaire
          </button>
        ) : (
          <div className="space-y-2">
            {partial && (
              <button type="button" className="btn-primary h-12 w-full" onClick={onRetryFailed}>
                <RotateCcw size={16} /> Renvoyer les catégories non enregistrées
              </button>
            )}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => navigate(ROUTES.EXPEDITION_HISTORY)}>
                Mes expéditions
              </button>
              <button type="button" className={`${partial ? 'btn-ghost' : 'btn-primary'} flex-1`} onClick={onNewExpedition}>
                Nouvel envoi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExtrapaysFormPage() {
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const country = useSelector((state) => state.country);
  const user = useSelector((state) => state.auth.user);

  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitResult, setSubmitResult] = useState(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [openColis, setOpenColis] = useState(0);
  const [expediteurOpen, setExpediteurOpen] = useState(true);

  const [countrySheetOpen, setCountrySheetOpen] = useState(!country.code);
  const [destSheetOpen, setDestSheetOpen] = useState(false);
  const [citySheetOpen, setCitySheetOpen] = useState(false);
  const [agenceSheetOpen, setAgenceSheetOpen] = useState(false);
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [productTargetColisIndex, setProductTargetColisIndex] = useState(null); // null = mode groupage, number = index colis LD

  const [mode, setMode] = useState('');
  const [paysDestination, setPaysDestination] = useState('');
  const [villeDestination, setVilleDestination] = useState('');
  const [articles, setArticles] = useState([]); // groupage: { produit_id, designation, reference, category, poids }
  const [colisList, setColisList] = useState([]); // LD: { poids, longueur, largeur, hauteur, articles: [{produit_id, designation, reference}], photo }
  const [agence, setAgence] = useState(null);
  const [typesChoisis, setTypesChoisis] = useState({}); // groupage: { category_id: type_expedition }
  const [expediteur, setExpediteur] = useState(EMPTY_CONTACT);
  const [destinataire, setDestinataire] = useState(EMPTY_CONTACT);
  // Enlèvement à domicile : mode livraison_domicile uniquement (pas encore
  // supporté par le backend en recuperation_agence).
  const [pickup, setPickup] = useState(EMPTY_PICKUP);

  const [products, setProducts] = useState([]);
  const [productsStatus, setProductsStatus] = useState('idle');

  // Destination countries actually tariffed from the departure backoffice
  // (GET /api/expedition/client/pays-disponibles).
  const [destinations, setDestinations] = useState([]);
  const [destinationsStatus, setDestinationsStatus] = useState('idle');
  const [destRetry, setDestRetry] = useState(0);

  const [devis, setDevis] = useState(null);
  const [devisStatus, setDevisStatus] = useState('idle');
  const [devisError, setDevisError] = useState('');
  const [devisRetry, setDevisRetry] = useState(0);

  // Saisie conservee si l'onglet est recharge (photos des colis comprises).
  // Un brouillon d'un autre pays de depart est ignore.
  const draftData = useMemo(
    () => ({
      v: DRAFT_VERSION, code_pays: country.code, step, maxStepReached, mode, paysDestination, villeDestination, articles,
      colisList, agence, typesChoisis, expediteur, destinataire, pickup,
    }),
    [country.code, step, maxStepReached, mode, paysDestination, villeDestination, articles,
      colisList, agence, typesChoisis, expediteur, destinataire, pickup]
  );
  const draft = useFormDraft(
    'tourshop:expedition-extrapays',
    draftData,
    (d) => {
      if (d.code_pays !== country.code) return false;
      const current = d.v === DRAFT_VERSION;
      setStep(current ? d.step ?? 1 : migrateStep(d.step ?? 1));
      setMaxStepReached(current ? d.maxStepReached ?? 1 : migrateStep(d.maxStepReached ?? 1));
      setMode(d.mode ?? '');
      setPaysDestination(d.paysDestination ?? '');
      setVilleDestination(d.villeDestination ?? '');
      setArticles(d.articles ?? []);
      setColisList(d.colisList ?? []);
      setAgence(d.agence ?? null);
      setTypesChoisis(d.typesChoisis ?? {});
      if (d.expediteur) setExpediteur(d.expediteur);
      if (d.destinataire) setDestinataire(d.destinataire);
      if (d.pickup) setPickup(d.pickup);
      return true;
    },
    !mode && !paysDestination
  );

  const isLD = mode === 'livraison_domicile';
  const destinationIsAfrican = isAfricanCountry(paysDestination);
  // Ville de destination demandée dès que la destination n'est pas africaine
  // (les deux modes).
  const villeRequise = Boolean(paysDestination) && !destinationIsAfrican;

  useEffect(() => {
    if (!user) return;
    setExpediteur((e) => (e.nom_prenom || e.telephone ? e : { ...e, nom_prenom: [user.nom, user.prenoms].filter(Boolean).join(' '), telephone: user.telephone || '' }));
  }, [user]);

  const expediteurOk = contactIsComplete(expediteur) && !identityExpired(expediteur);

  const goToStep = (n) => {
    // À l'arrivée sur les coordonnées, un expéditeur déjà complet reste replié.
    if (n === 3) setExpediteurOpen(!expediteurOk);
    setStep(n);
    setMaxStepReached((m) => Math.max(m, n));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    draft.clear();
    setStep(1);
    setMaxStepReached(1);
    setSubmitResult(null);
    setSubmitError('');
    setRecapOpen(false);
    setMode('');
    setPaysDestination('');
    setVilleDestination('');
    setArticles([]);
    setColisList([]);
    setOpenColis(0);
    setAgence(null);
    setTypesChoisis({});
    setExpediteur({
      ...EMPTY_CONTACT,
      nom_prenom: [user?.nom, user?.prenoms].filter(Boolean).join(' '),
      telephone: user?.telephone || '',
    });
    setDestinataire(EMPTY_CONTACT);
    setPickup(EMPTY_PICKUP);
    setDevis(null);
    setDevisStatus('idle');
  };

  const handleSelectMode = (value) => {
    if (value === mode) return;
    setMode(value);
    setDevis(null);
    setDevisStatus('idle');
    setTypesChoisis({});
    // Drop a destination that isn't tariffed for the new mode (e.g. an LD-only
    // country when switching to groupage) so the devis can't fail silently.
    const dest = destinations.find((d) => d.code_pays === paysDestination);
    if (paysDestination && !isDestinationCompatible(dest, value)) {
      setPaysDestination('');
      setVilleDestination('');
    }
    if (value === 'livraison_domicile') {
      setArticles([]);
      setColisList((list) => (list.length ? list : [{ ...EMPTY_LD_COLIS }]));
      setOpenColis(0);
    } else {
      setColisList([]);
    }
  };

  // Load the tariffed destination countries once the departure country is known.
  useEffect(() => {
    if (!country.code) return undefined;
    let cancelled = false;
    setDestinationsStatus('loading');
    expeditionService
      .listAvailableDestinations(country.code)
      .then((data) => {
        if (cancelled) return;
        setDestinations(data.pays ?? []);
        setDestinationsStatus('idle');
      })
      .catch(() => !cancelled && setDestinationsStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [country.code, destRetry]);

  useEffect(() => {
    if (!country.code || !mode) return;
    setProductsStatus('loading');
    // GET /produits ne filtre que par `code_pays` : en mode LD, l'eligibilite
    // (`eligible_ld === true`) est a la charge du frontend
    // (api-enregistrement-expedition-client.md).
    produitService
      .list({ code_pays: country.code })
      .then((data) => {
        const list = data.products ?? [];
        setProducts(mode === 'livraison_domicile' ? list.filter(isEligibleLd) : list);
        setProductsStatus('idle');
      })
      .catch(() => setProductsStatus('error'));
  }, [country.code, mode]);

  const trajetOk = Boolean(mode) && Boolean(paysDestination) && (!villeRequise || Boolean(villeDestination)) && Boolean(agence?.id);
  const ldColisOk = (c) => Number(c.poids) > 0 && c.articles.length > 0;
  const contenuOk = isLD
    ? colisList.length > 0 && colisList.every(ldColisOk)
    : articles.length > 0 && articles.every((a) => Number(a.poids) > 0);

  // Devis dès que le trajet est complet et que le contenu est saisi. En LD, le
  // backend exige au moins un produit par colis (422 « colis.0.articles field
  // is required » sinon), même si la doc le dit facultatif.
  const canComputeDevis = trajetOk && contenuOk;

  useEffect(() => {
    if (!canComputeDevis) {
      setDevis(null);
      setDevisStatus('idle');
      return undefined;
    }
    let cancelled = false;
    setDevisStatus('loading');
    const timer = setTimeout(async () => {
      try {
        let payload;
        if (mode === 'livraison_domicile') {
          payload = {
            mode,
            code_pays_depart: country.code,
            code_pays_destination: paysDestination,
            agence_id: agence.id,
            colis: colisList.map((c) => ({
              poids: Number(c.poids),
              longueur: Number(c.longueur) || 0,
              largeur: Number(c.largeur) || 0,
              hauteur: Number(c.hauteur) || 0,
              articles: c.articles.map((a) => ({ produit_id: a.produit_id })),
            })),
          };
        } else {
          payload = {
            mode,
            code_pays_depart: country.code,
            code_pays_destination: paysDestination,
            agence_id: agence.id,
            colis: [{ articles: articles.map((a) => ({ produit_id: a.produit_id, poids: Number(a.poids) })) }],
          };
        }
        if (villeRequise) payload.ville_destination = villeDestination;
        const data = await expeditionService.getDevis(payload);
        if (cancelled) return;
        setDevis(mode === 'livraison_domicile' ? data.devis ?? null : data.groupes ?? []);
        setDevisStatus('idle');
      } catch (err) {
        if (cancelled) return;
        const message =
          err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(' ') ||
          'Impossible de calculer le devis pour le moment.';
        setDevis(null);
        setDevisError(message);
        setDevisStatus('error');
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [canComputeDevis, mode, country.code, paysDestination, villeDestination, villeRequise, agence, articles, colisList, devisRetry]);

  // Auto-pick the type_expedition for groupage categories that only have one
  // eligible type (per api-enregistrement-expedition-client.md), and keep an
  // existing choice only if it is still among the eligible types.
  useEffect(() => {
    if (mode !== 'recuperation_agence' || !Array.isArray(devis)) return;
    setTypesChoisis((prev) => {
      const next = {};
      devis.forEach((g) => {
        if (g.types_eligibles.length === 1) {
          next[g.category_id] = g.types_eligibles[0].type_expedition;
        } else if (g.types_eligibles.length > 1 && g.types_eligibles.some((t) => t.type_expedition === prev[g.category_id])) {
          next[g.category_id] = prev[g.category_id];
        }
      });
      return next;
    });
  }, [devis, mode]);

  const handleSelectType = (categoryId, typeExpedition) => {
    setTypesChoisis((prev) => ({ ...prev, [categoryId]: typeExpedition }));
  };

  const addArticle = (product) => {
    setArticles((list) => [...list, {
      produit_id: product.id, designation: product.designation, reference: product.reference, category: product.category?.nom || '', poids: '',
    }]);
  };
  const updateArticlePoids = (index, poids) => {
    setArticles((list) => list.map((a, i) => (i === index ? { ...a, poids } : a)));
  };
  const removeArticle = (index) => {
    setArticles((list) => list.filter((_, i) => i !== index));
  };

  const addColis = () => {
    setColisList((list) => [...list, { ...EMPTY_LD_COLIS }]);
    setOpenColis(colisList.length);
  };
  const removeColis = (index) => {
    setColisList((list) => list.filter((_, i) => i !== index));
    setOpenColis(Math.max(0, index - 1));
  };
  const updateColisField = (index, field, value) =>
    setColisList((list) => list.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  const removeColisArticle = (colisIndex, articleIndex) =>
    setColisList((list) =>
      list.map((c, i) => (i === colisIndex ? { ...c, articles: c.articles.filter((_, ai) => ai !== articleIndex) } : c))
    );

  const openProductSheetForGroupage = () => {
    setProductTargetColisIndex(null);
    setProductSheetOpen(true);
  };
  const openProductSheetForColis = (index) => {
    setProductTargetColisIndex(index);
    setProductSheetOpen(true);
  };
  const handleProductSelect = (product) => {
    if (isLD) {
      setColisList((list) =>
        list.map((c, i) =>
          i === productTargetColisIndex
            ? { ...c, articles: [...c.articles, { produit_id: product.id, designation: product.designation, reference: product.reference }] }
            : c
        )
      );
    } else {
      addArticle(product);
    }
  };

  const availableProducts = isLD
    ? products.filter((p) => !(colisList[productTargetColisIndex]?.articles ?? []).some((a) => a.produit_id === p.id))
    : products.filter((p) => !articles.some((a) => a.produit_id === p.id));

  const stepLabels = ['Trajet', isLD ? 'Colis' : 'Articles', 'Coordonnées'];

  const groupes = !isLD && Array.isArray(devis) ? devis : [];
  const groupageHasShippableGroup = isLD || !Array.isArray(devis) || devis.some((g) => g.types_eligibles.length > 0);
  const groupageAllChoicesMade =
    isLD || !Array.isArray(devis) || devis.every((g) => g.types_eligibles.length === 0 || Boolean(typesChoisis[g.category_id]));
  const devisReady = devisStatus === 'idle' && (isLD ? Boolean(devis) : Array.isArray(devis));
  const canContinueContenu = contenuOk && devisReady && groupageHasShippableGroup && groupageAllChoicesMade;

  const contactsOk = expediteurOk && contactIsComplete(destinataire);

  const estimateTotal = computeEstimateTotal(mode, devis, typesChoisis);
  const totalLabel = estimateTotal != null ? formatPrice(estimateTotal) : null;
  const emballage = isLD ? (devis?.details_colis ?? []).reduce((s, d) => s + (Number(d.frais_emballage) || 0), 0) : 0;
  const destination = destinations.find((d) => d.code_pays === paysDestination);

  const submit = async () => {
    setRecapOpen(true);
    setSubmitting(true);
    setSubmitError('');
    try {
      const base = {
        mode,
        code_pays_depart: country.code,
        code_pays_destination: paysDestination,
        agence_id: agence.id,
        ...contactPayload('expediteur', expediteur),
        ...identityPayload(expediteur),
        ...contactPayload('destinataire', destinataire),
      };

      let payload;
      if (isLD) {
        payload = {
          ...base,
          colis: colisList.map((c) => ({
            poids: Number(c.poids),
            longueur: Number(c.longueur) || 0,
            largeur: Number(c.largeur) || 0,
            hauteur: Number(c.hauteur) || 0,
            prix_emballage: 0,
            articles: c.articles.map((a) => ({ produit_id: a.produit_id })),
            // Photo facultative (mode LD uniquement) : envoi multipart.
            photo: c.photo || undefined,
          })),
          ...pickupPayload(pickup),
        };
      } else {
        payload = {
          ...base,
          colis: [{
            articles: articles.map((a) => ({ produit_id: a.produit_id, poids: Number(a.poids) })),
          }],
          types_choisis: typesChoisis,
        };
      }
      if (villeRequise) payload.ville_destination = villeDestination;

      const result = await expeditionService.storeExpedition(payload);
      // Demande envoyee (meme partiellement) : ne pas la re-proposer.
      draft.clear();
      setRecapOpen(false);
      setSubmitResult(result);
    } catch (err) {
      // 422 "Aucune demande n'a pu être enregistrée." : le detail par
      // categorie est dans `resultats[]`, affiche comme un resultat.
      if (Array.isArray(err.response?.data?.resultats)) {
        setRecapOpen(false);
        setSubmitResult(err.response.data);
        return;
      }
      const message =
        err.response?.data?.message ||
        Object.values(err.response?.data?.errors || {}).flat().join(' ') ||
        "Impossible d'enregistrer l'expédition pour le moment.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Invité : la connexion s'ouvre par-dessus, la feuille se referme, et l'envoi
  // repart tout seul une fois connecté (useRequireAuth).
  const handleSubmit = () => {
    if (!isAuthenticated) setRecapOpen(false);
    requireAuth(submit, 'expedition');
  };

  // Succès partiel (groupage) : on garde seulement les articles des catégories
  // refusées, avec leur choix de type, et on revient à l'étape Articles.
  const retryFailed = () => {
    const failedIds = new Set((submitResult?.resultats ?? []).filter((r) => !r.success).map((r) => r.category_id));
    const failedProduits = new Set(
      (Array.isArray(devis) ? devis : [])
        .filter((g) => failedIds.has(g.category_id))
        .flatMap((g) => (g.articles ?? []).map((a) => a.produit_id))
    );
    if (failedProduits.size > 0) setArticles((list) => list.filter((a) => failedProduits.has(a.produit_id)));
    setTypesChoisis((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => failedIds.has(id))));
    setSubmitResult(null);
    goToStep(2);
  };

  // Retour (flèche de l'en-tête ou bouton système) : revient d'une étape ; à la
  // première, demande confirmation avant de quitter si une saisie existe. Une
  // feuille ouverte est fermée avant (pile des feuilles, useExitGuard).
  const dirty = Boolean(mode || paysDestination);
  const handleBack = () => {
    if (step > 1) {
      goToStep(step - 1);
      return;
    }
    if (dirty) exit.requestExit();
    else exit.leave();
  };
  const exit = useExitGuard({ active: dirty && !submitResult, onBack: handleBack, fallback: ROUTES.EXPEDITION_NEW });

  if (submitResult) {
    return (
      <SubmitResultScreen
        result={submitResult}
        pickupMode={isLD && pickup.domicile ? pickup.mode : null}
        pickupEstimate={isLD && pickup.domicile ? pickup.estimate : null}
        categoryNames={Array.isArray(devis) ? Object.fromEntries(devis.map((g) => [g.category_id, g.category_nom])) : {}}
        onNewExpedition={resetForm}
        onBack={() => setSubmitResult(null)}
        onRetryFailed={retryFailed}
      />
    );
  }

  if (!country.code) {
    return (
      <div>
        <TopBar title="Envoi international" back />
        <div className="page-container py-4">
          <EmptyState
            icon={MapPinned}
            title="Choisissez votre pays de départ"
            description="Sélectionnez votre pays pour voir les agences et produits disponibles."
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

  const modeInfo = MODES.find((m) => m.value === mode);
  // Libellés lisibles des types disponibles (« LD » est un terme interne).
  const badges = destinationBadges(destination, mode).map((b) => (b === 'LD' ? 'Livraison à domicile disponible' : b));

  return (
    <div>
      <TopBar
        title="Envoi international"
        subtitle={`Départ ${getFlagEmoji(country.code)} ${country.name}`}
        back
        onBack={handleBack}
        backLabel={step > 1 ? 'Étape précédente' : "Quitter l'envoi"}
      />
      <div className="page-container pb-2 pt-1">
        {draft.restored && <DraftRestoredBanner onReset={resetForm} className="mb-3" />}
        <StepBar step={step} labels={stepLabels} maxStepReached={maxStepReached} onStepClick={goToStep} />

        {/* ---------- Étape 1 : Trajet ---------- */}
        {step === 1 && (
          <>
            <div className="space-y-4">
              <div>
                <h2 className="mb-2 font-heading text-lg font-semibold text-surface-900">Comment le colis arrive-t-il ?</h2>
                <div className="flex gap-1 rounded-2xl bg-surface-100 p-1" role="radiogroup" aria-label="Mode d'envoi">
                  {MODES.map((m) => {
                    const active = mode === m.value;
                    const ModeIcon = m.icon;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => handleSelectMode(m.value)}
                        className={`flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${
                          active ? 'bg-white text-primary-700 shadow-card' : 'text-surface-500'
                        }`}
                      >
                        <ModeIcon size={17} /> {m.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-caption text-surface-500">
                  {modeInfo ? modeInfo.hint : 'Choisissez un mode : il détermine les destinations et le calcul du tarif.'}
                </p>
              </div>

              <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3">
                <RouteRail />
                <div className="space-y-4">
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-surface-700">Départ</p>
                    <div className="flex h-16 items-center gap-3 rounded-xl border border-surface-200 bg-surface-100 px-3">
                      <span className="text-2xl leading-none">{getFlagEmoji(country.code)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-surface-700">{country.name}</span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-surface-700">Destination</p>
                    {destinationsStatus === 'error' ? (
                      <button
                        type="button"
                        onClick={() => setDestRetry((t) => t + 1)}
                        className="flex h-16 w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3 text-left text-sm font-medium text-red-700"
                      >
                        <AlertTriangle size={18} className="shrink-0" /> Destinations indisponibles · Réessayer
                      </button>
                    ) : (
                      <PickerButton
                        icon={Globe2}
                        selected={Boolean(paysDestination)}
                        disabled={!mode}
                        title={paysDestination ? `${getFlagEmoji(paysDestination)}  ${getCountryName(paysDestination)}` : 'Choisir un pays'}
                        subtitle={
                          !mode ? "Choisissez d'abord le mode" : paysDestination ? badges.join(' · ') || null : 'Pays desservis depuis votre agence'
                        }
                        onClick={() => setDestSheetOpen(true)}
                      />
                    )}
                  </div>
                </div>
              </div>

              {villeRequise && (
                <div>
                  <p className="mb-1.5 text-sm font-medium text-surface-700">Ville de destination</p>
                  {cityService.hasCitySearch(paysDestination) ? (
                    <PickerButton
                      icon={Search}
                      selected={Boolean(villeDestination)}
                      title={villeDestination || 'Rechercher une ville'}
                      subtitle={villeDestination ? `${getCountryName(paysDestination)}` : 'Nécessaire hors Afrique'}
                      onClick={() => setCitySheetOpen(true)}
                    />
                  ) : (
                    <input
                      id="ville-destination"
                      className="input-field h-14"
                      placeholder="Ex : Marseille"
                      autoComplete="address-level2"
                      value={villeDestination}
                      onChange={(e) => setVilleDestination(e.target.value)}
                    />
                  )}
                </div>
              )}

              <div>
                <p className="mb-1.5 text-sm font-medium text-surface-700">Agence de départ</p>
                <PickerButton
                  icon={Building2}
                  selected={Boolean(agence)}
                  title={agence ? agence.nom_agence : 'Choisir une agence'}
                  subtitle={agence ? [agence.adresse, agence.commune || agence.ville].filter(Boolean).join(', ') : 'Où vous déposez le colis'}
                  onClick={() => setAgenceSheetOpen(true)}
                />
              </div>
            </div>

            <ActionDock>
              <button type="button" className="btn-primary h-12 flex-1" disabled={!trajetOk} onClick={() => goToStep(2)}>
                Continuer
              </button>
            </ActionDock>
          </>
        )}

        {/* ---------- Étape 2 (à domicile) : Colis ---------- */}
        {step === 2 && isLD && (
          <>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-heading text-lg font-semibold text-surface-900">Vos colis</h2>
                <p className="min-w-0 truncate text-caption text-surface-500">
                  → {getFlagEmoji(paysDestination)} {getCountryName(paysDestination)}{villeDestination ? `, ${villeDestination}` : ''}
                </p>
              </div>

              {colisList.map((c, i) => {
                const open = openColis === i;
                const valid = ldColisOk(c);
                const prix = devis?.details_colis?.[i]?.total;
                const summary = [
                  Number(c.poids) > 0 ? fmtKg(c.poids) : 'Poids à indiquer',
                  dimsOf(c),
                  c.articles.length ? `${c.articles.length} produit${c.articles.length > 1 ? 's' : ''}` : 'Contenu à indiquer',
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
                        <span className="block truncate text-sm font-semibold text-surface-900">Colis {i + 1}</span>
                        <span className={`block truncate text-caption ${valid ? 'text-surface-500' : 'text-amber-700'}`}>{summary}</span>
                      </span>
                      {prix != null && devisStatus === 'idle' && (
                        <span className="shrink-0 font-heading text-sm font-bold text-primary-700">{formatPrice(prix)}</span>
                      )}
                      <ChevronDown size={18} className={`shrink-0 text-surface-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>

                    {open && (
                      <div className="space-y-4 border-t border-surface-100 px-4 pb-4 pt-3">
                        <WeightStepper id={`colis-${i}-poids`} value={c.poids} onChange={(v) => updateColisField(i, 'poids', v)} />

                        <fieldset>
                          <legend className="mb-1.5 text-sm font-medium text-surface-700">Dimensions (cm, optionnel)</legend>
                          <div className="grid grid-cols-3 gap-2">
                            {[['longueur', 'Longueur'], ['largeur', 'Largeur'], ['hauteur', 'Hauteur']].map(([key, label]) => (
                              <label key={key} htmlFor={`colis-${i}-${key}`} className="block text-center text-caption text-surface-500">
                                <input
                                  id={`colis-${i}-${key}`}
                                  type="text"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  placeholder="0"
                                  className="input-field mb-1 text-center"
                                  value={decimalDisplay(c[key])}
                                  onChange={(e) => updateColisField(i, key, decimalClean(e.target.value))}
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                          <p className="mt-1 text-caption text-surface-400">Servent au calcul du poids volumétrique.</p>
                        </fieldset>

                        <div>
                          <p className="mb-1.5 text-sm font-medium text-surface-700">Contenu du colis</p>
                          <div className="flex flex-wrap gap-2">
                            {c.articles.map((a, ai) => (
                              <span
                                key={`${a.produit_id}-${ai}`}
                                className="inline-flex min-h-10 items-center gap-1 rounded-full bg-primary-50 pl-3.5 text-sm font-medium text-primary-800"
                              >
                                {a.designation}
                                <button
                                  type="button"
                                  onClick={() => removeColisArticle(i, ai)}
                                  aria-label={`Retirer ${a.designation}`}
                                  className="flex h-10 w-10 items-center justify-center rounded-full text-primary-600 active:bg-primary-100"
                                >
                                  <X size={15} />
                                </button>
                              </span>
                            ))}
                            <button
                              type="button"
                              onClick={() => openProductSheetForColis(i)}
                              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 border-dashed border-primary-200 px-3.5 text-sm font-semibold text-primary-600 active:scale-95"
                            >
                              <Plus size={15} /> Ajouter un produit
                            </button>
                          </div>
                          {c.articles.length === 0 ? (
                            <p className="mt-1.5 text-caption text-amber-700">Ajoutez au moins un produit pour ce colis.</p>
                          ) : (
                            <p className="mt-1.5 text-caption text-surface-400">Décrit le contenu, sans effet sur le prix.</p>
                          )}
                        </div>

                        <ProofPicker
                          file={c.photo || null}
                          onChange={(f) => updateColisField(i, 'photo', f)}
                          label="Photo du colis (optionnel)"
                          icon={Camera}
                          camera
                          removeLabel="Retirer la photo du colis"
                        />

                        {colisList.length > 1 && (
                          <button type="button" onClick={() => removeColis(i)} className="btn w-full text-red-600 hover:bg-red-50">
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

              {devisStatus === 'error' && <ErrorNote message={devisError} onRetry={() => setDevisRetry((t) => t + 1)} />}
            </div>

            <ActionDock>
              <DockTotal label={`Estimation · ${colisList.length} colis`} amount={totalLabel} status={devisStatus} />
              <button type="button" className="btn-primary h-12 flex-1" disabled={!canContinueContenu} onClick={() => goToStep(3)}>
                Continuer
              </button>
            </ActionDock>
          </>
        )}

        {/* ---------- Étape 2 (en agence) : Articles + mode par catégorie ---------- */}
        {step === 2 && !isLD && (
          <>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-heading text-lg font-semibold text-surface-900">Vos articles</h2>
                <p className="min-w-0 truncate text-caption text-surface-500">
                  → {getFlagEmoji(paysDestination)} {getCountryName(paysDestination)}
                </p>
              </div>

              {articles.length === 0 ? (
                <EmptyState
                  illustration={<EmptyParcelAnimation />}
                  float={false}
                  title="Aucun article ajouté"
                  description="Ajoutez les produits à expédier et indiquez le poids de chacun."
                  action={(
                    <button type="button" onClick={openProductSheetForGroupage} className="btn-primary">
                      <Plus size={18} /> Ajouter un produit
                    </button>
                  )}
                />
              ) : (
                <>
                  <ul className="card divide-y divide-surface-100 px-4">
                    {articles.map((a, i) => (
                      <li key={`${a.produit_id}-${i}`} className="flex min-h-[72px] items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-surface-900">{a.designation}</p>
                          <p className="truncate text-caption text-surface-500">{a.category || a.reference}</p>
                        </div>
                        <label
                          htmlFor={`article-${i}-poids`}
                          className={`flex h-12 w-[6.5rem] shrink-0 items-center gap-1 rounded-xl border bg-white pr-3 focus-within:ring-2 focus-within:ring-primary-500 ${
                            Number(a.poids) > 0 ? 'border-surface-200' : 'border-amber-300'
                          }`}
                        >
                          <input
                            id={`article-${i}-poids`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0"
                            aria-label={`Poids de ${a.designation} en kg`}
                            className="w-full min-w-0 bg-transparent text-right font-heading font-bold text-surface-900 placeholder:text-surface-300 focus:outline-none"
                            value={decimalDisplay(a.poids)}
                            onChange={(e) => updateArticlePoids(i, decimalClean(e.target.value))}
                          />
                          <span className="text-caption text-surface-500">kg</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeArticle(i)}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-surface-400 active:bg-red-50 active:text-red-600"
                          aria-label={`Retirer ${a.designation}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={openProductSheetForGroupage}
                    className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary-200 text-sm font-semibold text-primary-600 transition active:scale-[0.99]"
                  >
                    <Plus size={18} /> Ajouter un produit
                  </button>
                </>
              )}

              {articles.length > 0 && !contenuOk && (
                <p className="text-caption text-amber-700">Indiquez le poids de chaque article pour obtenir le devis.</p>
              )}

              {devisStatus === 'error' && <ErrorNote message={devisError} onRetry={() => setDevisRetry((t) => t + 1)} />}

              {groupes.length > 0 && devisStatus !== 'error' && (
                <div className="space-y-2.5 pt-2">
                  <h3 className="font-heading text-[15px] font-semibold text-surface-900">Mode d'expédition par catégorie</h3>
                  {!groupageHasShippableGroup && groupes.length > 1 && (
                    <ErrorNote message="Aucun tarif pour ces articles vers cette destination. Modifiez les articles ou la destination." />
                  )}
                  {groupes.map((g) => (
                    <GroupTypeChoice key={g.category_id} group={g} chosen={typesChoisis[g.category_id]} onSelect={handleSelectType} />
                  ))}
                </div>
              )}
            </div>

            <ActionDock>
              <DockTotal label="Estimation" amount={totalLabel} status={devisStatus} />
              <button type="button" className="btn-primary h-12 flex-1" disabled={!canContinueContenu} onClick={() => goToStep(3)}>
                {devisReady && !groupageAllChoicesMade ? 'Choisir les modes' : 'Continuer'}
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
                  <ContactFields title="Expéditeur" data={expediteur} onChange={setExpediteur}>
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

              <ContactFields
                title="Destinataire"
                data={destinataire}
                onChange={setDestinataire}
                withLocation={isLD}
                locationLabel="Point de livraison"
              />

              {isLD && (
                <PickupOption
                  value={pickup}
                  onChange={setPickup}
                  agence={agence}
                  communeId={agence?.commune_id}
                  address={[expediteur.adresse, expediteur.quartier, expediteur.ville].filter((v) => v?.trim()).join(', ')}
                />
              )}

              {!contactsOk && (
                <p className="text-caption text-surface-500">
                  Nom, téléphone, adresse et ville sont requis pour l'expéditeur et le destinataire.
                </p>
              )}
            </div>

            <ActionDock>
              <DockTotal label="Estimation" amount={totalLabel} status={devisStatus} />
              <button
                type="button"
                className="btn-primary h-12 flex-1"
                disabled={!contactsOk || !canContinueContenu}
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
            <Row label="Mode" value={isLD ? 'Livraison à domicile' : 'Récupération en agence'} />
            <Row
              label="Trajet"
              value={`${getFlagEmoji(country.code)} ${country.name} → ${getFlagEmoji(paysDestination)} ${getCountryName(paysDestination)}${villeDestination ? `, ${villeDestination}` : ''}`}
            />
            <Row label="Agence de départ" value={agence?.nom_agence} />
            <Row
              label={isLD ? 'Colis' : 'Articles'}
              value={
                isLD
                  ? `${colisList.length} · ${fmtKg(colisList.reduce((s, c) => s + (Number(c.poids) || 0), 0))}`
                  : `${articles.length} · ${fmtKg(articles.reduce((s, a) => s + (Number(a.poids) || 0), 0))}`
              }
            />
            {isLD && (
              <Row
                label="Remise"
                value={pickup.domicile ? `Enlèvement à domicile (${pickup.mode === 'groupage' ? 'retrait classique' : 'récupération express'})` : "Dépôt à l'agence"}
              />
            )}
            {isLD && pickup.domicile && (
              <Row
                label="Enlèvement (estimé)"
                value={pickup.estimate?.total != null ? formatPrice(pickup.estimate.total) : 'Confirmé par l’agence'}
              />
            )}
            <Row label="Expéditeur" value={expediteur.nom_prenom} />
            <Row label="Destinataire" value={`${destinataire.nom_prenom} · ${destinataire.telephone}`} />
          </div>

          {!isLD && groupes.some((g) => typesChoisis[g.category_id]) && (
            <div className="space-y-1.5 rounded-xl bg-surface-50 p-3 text-sm">
              {groupes.filter((g) => typesChoisis[g.category_id]).map((g) => {
                const t = g.types_eligibles.find((x) => x.type_expedition === typesChoisis[g.category_id]);
                return (
                  <div key={g.category_id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-surface-600">{g.category_nom} · {typeLabel(t?.type_expedition)}</span>
                    <span className="shrink-0 font-semibold text-surface-900">{t ? formatPrice(t.montant_expedition) : '—'}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-2xl bg-primary-50 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-primary-700">Montant estimé</span>
              <span className="font-heading text-2xl font-bold text-primary-800">{totalLabel}</span>
            </div>
            {emballage > 0 && (
              <p className="mt-1 text-right text-caption text-primary-700">dont emballage {formatPrice(emballage)}</p>
            )}
            {isLD && pickup.domicile && pickup.estimate?.total != null && estimateTotal != null && (
              <p className="mt-1 text-right text-caption text-primary-700">
                + enlèvement {formatPrice(pickup.estimate.total)} · total à prévoir {formatPrice(Number(estimateTotal) + Number(pickup.estimate.total))}
              </p>
            )}
          </div>
          {isLD && pickup.domicile && <FeeBreakdown detail={pickup.estimate} />}

          <p className="flex items-start gap-2 text-caption text-surface-500">
            <Globe2 size={14} className="mt-0.5 shrink-0" />
            <span>
              Le montant final est recalculé à l'enregistrement. {isLD && pickup.domicile && "L'enlèvement est facturé en plus de l'envoi ; son montant est confirmé à l'enregistrement. "}
              L'agence de départ doit accepter la demande avant de la traiter.
            </span>
          </p>

          {submitError && <ErrorNote message={submitError} />}

          <div className="space-y-2">
            <button type="button" className="btn-primary h-12 w-full" disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Envoi…' : isAuthenticated ? `Confirmer${totalLabel ? ` · ${totalLabel}` : ''}` : 'Se connecter pour confirmer'}
            </button>
            <button type="button" className="btn-secondary w-full" disabled={submitting} onClick={() => setRecapOpen(false)}>
              Modifier
            </button>
          </div>
        </div>
      </BottomSheet>

      <ExitFlowSheet
        open={exit.confirmOpen}
        progress={`Étape ${step} sur ${stepLabels.length} · ${stepLabels[step - 1]}`}
        amount={totalLabel}
        onStay={exit.stay}
        onKeep={exit.leave}
        onDiscard={() => {
          draft.clear();
          exit.leave();
        }}
      />
      <DestinationCountrySheet
        open={destSheetOpen}
        onClose={() => setDestSheetOpen(false)}
        destinations={destinations}
        status={destinationsStatus}
        mode={mode}
        currentCode={paysDestination}
        onSelect={(code) => {
          setPaysDestination(code);
          setVilleDestination('');
        }}
        onRetry={() => setDestRetry((t) => t + 1)}
      />
      <CitySelectSheet
        open={citySheetOpen}
        onClose={() => setCitySheetOpen(false)}
        codePays={paysDestination}
        onSelect={setVilleDestination}
        title="Ville de destination"
      />
      <AgencySelectSheet
        open={agenceSheetOpen}
        onClose={() => setAgenceSheetOpen(false)}
        codePays={country.code}
        currentId={agence?.id}
        onSelect={setAgence}
      />
      <ProductSelectSheet
        open={productSheetOpen}
        onClose={() => setProductSheetOpen(false)}
        products={availableProducts}
        status={productsStatus}
        onSelect={handleProductSelect}
      />
    </div>
  );
}
