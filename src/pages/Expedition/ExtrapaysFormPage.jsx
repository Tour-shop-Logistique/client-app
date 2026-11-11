import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setCountry } from '../../store/slices/countrySlice';
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
  ErrorNote, PickerButton, RouteRail, SummaryRow as Row,
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
import CommuneSelectSheet from '../../components/expedition/CommuneSelectSheet';
import AgencySelectSheet from '../../components/expedition/AgencySelectSheet';
import ProductSelectSheet from '../../components/expedition/ProductSelectSheet';
import DestinationCountrySheet from '../../components/expedition/DestinationCountrySheet';
import PickupOption from '../../components/expedition/PickupOption';
import CreditOption from '../../components/expedition/CreditOption';
import FeeBreakdown from '../../components/expedition/FeeBreakdown';
import { EMPTY_PICKUP, PICKUP_MODE_MESSAGE, missionRequestPayload, pickupPayload } from '../../utils/pickup';
import { ProofPicker } from '../../components/marketplace/FilePickers';
import useRequireAuth from '../../hooks/useRequireAuth';
import expeditionService from '../../services/expeditionService';
import produitService from '../../services/produitService';
import cityService from '../../services/cityService';
import { getCountryName, getFlagEmoji } from '../../utils/countries';
import { isDestinationCompatible, destinationBadges } from '../../utils/expedition';
import { isAfricanCountry } from '../../utils/africa';
import { formatPrice } from '../../utils/format';
import { departureCurrency } from '../../utils/currency';
import { decimalClean, decimalDisplay, fmtKg } from '../../utils/decimal';
import { ROUTES, expeditionDetailPath } from '../../routes';
import InvoiceDownloadButton from '../../components/invoice/InvoiceDownloadButton';
import IdentityFields from '../../components/expedition/IdentityFields';
import {
  EMPTY_CONTACT, contactIsComplete, contactPayload, focusFirstInvalid, expediteurFromProfile, fillEmptyFields, identityExpired, identityNumberMissing, identityPayload,
} from '../../utils/contact';
import ContactFields from '../../components/expedition/ContactFields';

// Parcours mobile en 3 étapes : Trajet (mode, destination, agence) -> Colis ou
// Articles -> Coordonnées, puis une feuille de vérification avant `store`.
// L'agence est choisie dès le Trajet : le devis (POST /devis) peut donc tourner
// pendant la saisie des colis, et l'estimation reste visible dans la barre du bas.

const DRAFT_VERSION = 4;

// Le backend répond « Aucun backoffice actif pour ce pays. » quand un pays n'est
// pas desservi : on affiche un message simple plutôt que le texte technique.
const UNSUPPORTED_DESTINATION_MESSAGE = "Cette destination n'est pas prise en charge pour le moment.";
const isUnsupportedCountry = (err) => /aucun backoffice actif/i.test(err?.response?.data?.message || '');
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
function computeEstimateTotal(mode, devis, typesChoisis, offres, offresChoisies = [], montantFinal = null) {
  if (mode === 'livraison_domicile') return devis?.montant_expedition ?? null;
  // Offres DHD / CA : prix final du 2e appel au devis (`montant_total`, promotions
  // comprises) ; en attendant, somme des offres cochées (aucune présélection).
  if (Array.isArray(offres)) {
    if (montantFinal != null && offresChoisies.length) return Number(montantFinal);
    const chosen = offres.filter((o) => offresChoisies.includes(o.code));
    return chosen.length ? chosen.reduce((sum, o) => sum + Number(o.montant_total || 0), 0) : null;
  }
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
function GroupTypeChoice({ group, chosen, onSelect, currency }) {
  const fmt = (v) => formatPrice(v, currency);
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
                <span className="shrink-0 font-heading text-sm font-bold text-surface-900">{fmt(t.montant_expedition)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Offre DHD / CA du devis (api-devis-client.md, « Offres DHD / CA ») : une offre
// = une expédition (un type, une facture). Case à cocher, détail par catégorie
// dépliable. Pas de recommandation ni de présélection : le client compare.
function OfferCard({ offre, checked, onToggle, currency, categoryNames, single = false }) {
  const [open, setOpen] = useState(false);
  const fmt = (v) => formatPrice(v, currency);
  const exp = offre.expedition || {};
  const details = Array.isArray(exp.detail_categories) ? exp.detail_categories : [];
  const catIds = Object.keys(offre.types_choisis || {});
  // Promotion de tarif (api-promotions-tarifs.md) : `montant_expedition` est déjà réduit.
  const promoRemise = Number(exp.montant_remise_promotion) || 0;
  const promoNom = typeof exp.promotion === 'string' ? exp.promotion : exp.promotion?.nom || exp.promotion?.libelle || '';
  const contenu = details.length
    ? details.map((d) => d.category_nom).filter(Boolean)
    : catIds.map((id) => categoryNames[id]).filter(Boolean);
  return (
    <div className={`overflow-hidden rounded-xl border transition ${checked ? 'border-primary-600 bg-primary-50' : 'border-surface-200 bg-white'}`}>
      <button
        type="button"
        role={single ? undefined : 'checkbox'}
        aria-checked={single ? undefined : checked}
        disabled={single}
        onClick={() => onToggle(offre.code)}
        className={`flex min-h-[60px] w-full items-center gap-3 px-3 py-2.5 text-left ${single ? 'cursor-default' : 'active:scale-[0.99]'}`}
      >
        {!single && (
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
              checked ? 'border-primary-600 bg-primary-600 text-white' : 'border-surface-300'
            }`}
          >
            {checked && <Check size={13} strokeWidth={3} />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold ${checked ? 'text-primary-800' : 'text-surface-900'}`}>
            {offre.libelle || typeLabel(exp.type_expedition)}
          </span>
          {contenu.length > 0 && <span className="block truncate text-caption text-surface-500">{contenu.join(' · ')}</span>}
          {exp.poids_total != null && <span className="block text-caption text-surface-500">Poids : {fmtKg(exp.poids_total)}</span>}
        </span>
        <span className="shrink-0 text-right">
          {promoRemise > 0 && exp.montant_avant_promotion != null && (
            <span className="block text-caption text-surface-400 line-through">{fmt(exp.montant_avant_promotion)}</span>
          )}
          <span className="block font-heading text-sm font-bold text-surface-900">{fmt(offre.montant_total)}</span>
        </span>
      </button>
      {promoRemise > 0 && (
        <p className="px-3 pb-2 text-caption font-medium text-emerald-700">
          {promoNom ? `${promoNom} : ` : 'Promotion : '}-{fmt(promoRemise)}
        </p>
      )}
      {exp.minimum_applique && (
        <p className="mx-3 mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-caption text-amber-800">
          Le tarif de base de cette ligne est de <strong>{fmt(exp.montant_avant_promotion ?? exp.montant_expedition ?? offre.montant_total)}</strong>.
          {exp.montant_calcule != null ? ` Vos articles ne totalisent que ${fmt(exp.montant_calcule)} : ce tarif de base s'applique.` : ''}
        </p>
      )}
      {details.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center gap-1 border-t border-surface-100 px-3 py-2 text-caption font-semibold text-primary-600"
          >
            {open ? 'Masquer le détail' : 'Voir le détail par catégorie'}
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <ul className="space-y-1 px-3 pb-3 text-caption">
              {details.map((d) => (
                <li key={d.category_id} className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-surface-600">
                    {d.category_nom} · {fmtKg(d.poids)}{d.prix_unitaire != null ? ` × ${fmt(d.prix_unitaire)}/kg` : ''}
                  </span>
                  <span className="shrink-0 font-semibold text-surface-900">{fmt(d.montant)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// Coche / décoche une offre en respectant `cumulable_avec[]` : une offre
// exclusive (CA_COMBINE, `cumulable_avec: []`) décoche tout le reste, et les
// offres hors CA (DHD Aérien / Maritime) ne se cumulent jamais entre elles.
function toggleOffre(selected, code, offres) {
  if (selected.includes(code)) return selected.filter((c) => c !== code);
  const offre = offres.find((o) => o.code === code);
  if (!offre) return selected;
  const allowed = offre.cumulable_avec || [];
  const kept = selected.filter((c) => {
    const other = offres.find((o) => o.code === c);
    return allowed.includes(c) && (other?.cumulable_avec || []).includes(code);
  });
  return [...kept, code];
}

// Résultat de `store`. Livraison à domicile : une expédition. Récupération en
// agence : 201 (succès total/partiel) ou 422 (aucune créée), toujours avec
// `resultats[]` par catégorie — chaque échec porte son `message`.
function SubmitResultScreen({ result, pickupMode, pickupEstimate, currency, categoryNames = {}, onNewExpedition, onBack, onRetryFailed }) {
  const navigate = useNavigate();
  const fmt = (v) => formatPrice(v, currency);
  const isGroupage = Array.isArray(result.resultats) || Array.isArray(result.expeditions);
  // `expeditions[]` (une entrée par expédition réellement créée) est à privilégier :
  // avec une offre combinée, plusieurs catégories partagent la même expédition.
  const successes = Array.isArray(result.expeditions) && result.expeditions.length
    ? result.expeditions.map((exp) => ({ expedition: exp }))
    : isGroupage
      ? (result.resultats ?? []).filter((r) => r.success)
      : result.expedition ? [{ expedition: result.expedition }] : [];
  const failures = isGroupage ? (result.resultats ?? []).filter((r) => !r.success) : [];
  const nonEnvoyees = (result.category_ids_non_envoyees ?? []).map((id) => categoryNames[id]).filter(Boolean);
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
                ? `${successes.length} expédition${successes.length > 1 ? 's' : ''} enregistrée${successes.length > 1 ? 's' : ''}, ${failures.length} en échec. L'agence va examiner votre demande.`
                : "En attente d'acceptation par l'agence de départ."
            }
          >
            {successes.length === 1 && !partial && <CopyReference reference={successes[0].expedition.reference} />}
            {pickupMode && result.pickupError ? (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{result.pickupError}</p>
            ) : pickupMode && (
              <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-primary-700">
                {PICKUP_MODE_MESSAGE[pickupMode]}
                {pickupEstimate?.total != null && <> Montant de l’enlèvement : <strong>{fmt(pickupEstimate.total)}</strong>.</>}
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
                <span className="shrink-0 font-heading text-sm font-bold text-primary-700">{fmt(exp.montant_expedition)}</span>
              </button>
            ))}
            {nonEnvoyees.length > 0 && (
              <p className="rounded-xl bg-amber-50 p-3 text-caption text-amber-800">
                Non envoyé (hors des offres choisies) : {nonEnvoyees.join(', ')}.
              </p>
            )}
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
  const dispatch = useDispatch();
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const country = useSelector((state) => state.country);
  const user = useSelector((state) => state.auth.user);
  // Devise des montants : celle du pays de départ choisi (peut différer du compte).
  const currency = departureCurrency(country.code, user);
  const fmt = (v) => formatPrice(v, currency);

  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitResult, setSubmitResult] = useState(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [openColis, setOpenColis] = useState(0);

  const [countrySheetOpen, setCountrySheetOpen] = useState(!country.code);
  const [destSheetOpen, setDestSheetOpen] = useState(false);
  const [citySheetOpen, setCitySheetOpen] = useState(false);
  const [communeSheetOpen, setCommuneSheetOpen] = useState(false);
  const [agenceSheetOpen, setAgenceSheetOpen] = useState(false);
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [productTargetColisIndex, setProductTargetColisIndex] = useState(null); // null = mode groupage, number = index colis LD

  const [mode, setMode] = useState('');
  const [paysDestination, setPaysDestination] = useState('');
  const [villeDestination, setVilleDestination] = useState('');
  // Commune d'arrivée (groupage CA, hors Afrique) : optionnelle, affine la
  // résolution du tarif CA côté backend (sinon repli sur la ligne texte).
  const [communeDestinationId, setCommuneDestinationId] = useState('');
  const [communes, setCommunes] = useState([]);
  const [communesStatus, setCommunesStatus] = useState('idle');
  const [communesRetry, setCommunesRetry] = useState(0);
  const [articles, setArticles] = useState([]); // groupage: { produit_id, designation, reference, category, poids }
  const [colisList, setColisList] = useState([]); // LD: { poids, longueur, largeur, hauteur, articles: [{produit_id, designation, reference}], photo }
  const [agence, setAgence] = useState(null);
  const [typesChoisis, setTypesChoisis] = useState({}); // groupage (ancien format) : { category_id: type_expedition }
  // Offres DHD / CA du devis (`offres[]`) et codes cochés par le client.
  const [offres, setOffres] = useState(null);
  const [offresChoisies, setOffresChoisies] = useState([]);
  // 2e appel au devis avec `types_choisis` : prix réel final (`expeditions_prevues[]` + `montant_total`).
  const [devisFinal, setDevisFinal] = useState(null);
  const [finalStatus, setFinalStatus] = useState('idle'); // idle | loading | error
  const [finalError, setFinalError] = useState('');
  const [expediteur, setExpediteur] = useState(EMPTY_CONTACT);
  const [destinataire, setDestinataire] = useState(EMPTY_CONTACT);
  // Enlèvement à domicile : disponible dans les deux modes (livraison_domicile
  // et recuperation_agence) : champs `enlevement_*` du `store` en LD, demander-enlevement après le `store` en agence.
  const [pickup, setPickup] = useState(EMPTY_PICKUP);
  // Paiement différé : groupage (recuperation_agence) seulement, ignoré en LD.
  const [paiementCredit, setPaiementCredit] = useState(false);

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
      v: DRAFT_VERSION, code_pays: country.code, step, maxStepReached, mode, paysDestination, villeDestination, communeDestinationId, articles,
      colisList, agence, typesChoisis, offresChoisies, expediteur, destinataire, pickup, paiementCredit,
    }),
    [country.code, step, maxStepReached, mode, paysDestination, villeDestination, communeDestinationId, articles,
      colisList, agence, typesChoisis, offresChoisies, expediteur, destinataire, pickup, paiementCredit]
  );
  const draft = useFormDraft(
    'tourshop:expedition-extrapays',
    draftData,
    (d) => {
      if (d.code_pays !== country.code) return false;
      // v2/v3 (Coordonnées en une seule étape 3, Remise en 4) : la Remise passe en 5.
      const toStep = (s) => {
        const n = s ?? 1;
        if (d.v >= 4) return n;
        if (d.v >= 2) return n >= 4 ? n + 1 : n;
        const m = migrateStep(n);
        return m >= 4 ? m + 1 : m;
      };
      setStep(toStep(d.step));
      setMaxStepReached(toStep(d.maxStepReached));
      setMode(d.mode ?? '');
      setPaysDestination(d.paysDestination ?? '');
      setVilleDestination(d.villeDestination ?? '');
      setCommuneDestinationId(d.communeDestinationId ?? '');
      setArticles(d.articles ?? []);
      setColisList(d.colisList ?? []);
      setAgence(d.agence ?? null);
      setTypesChoisis(d.typesChoisis ?? {});
      setOffresChoisies(Array.isArray(d.offresChoisies) ? d.offresChoisies : []);
      if (d.expediteur) setExpediteur(d.expediteur);
      if (d.destinataire) setDestinataire(d.destinataire);
      if (d.pickup) setPickup(d.pickup);
      setPaiementCredit(Boolean(d.paiementCredit));
      return true;
    },
    !mode && !paysDestination
  );

  const isLD = mode === 'livraison_domicile';
  const destinationIsAfrican = isAfricanCountry(paysDestination);
  // En agence : destination demandée pour tous les pays (sans elle, ni DHD ni CA
  // ne peuvent être proposés), choisie dans les communes du pays. À domicile :
  // demandée hors Afrique seulement.
  const villeRequise = Boolean(paysDestination) && (mode === 'recuperation_agence' || !destinationIsAfrican);
  const communeApplicable = Boolean(paysDestination) && mode === 'recuperation_agence';
  const communeDestination = communes.find((c) => c.id === communeDestinationId) || null;
  const villeDepart = (agence?.ville || agence?.commune || '').trim();

  useEffect(() => {
    if (!user) return;
    // Profil du client : nom, telephone, e-mail, WhatsApp, adresse favorite (champs vides seulement).
    setExpediteur((e) => fillEmptyFields(e, expediteurFromProfile(user)));
  }, [user]);

  const expediteurOk = contactIsComplete(expediteur) && !identityNumberMissing(expediteur) && !identityExpired(expediteur);

  const goToStep = (n) => {
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
    setCommuneDestinationId('');
    setArticles([]);
    setColisList([]);
    setOpenColis(0);
    setAgence(null);
    setTypesChoisis({});
    setOffresChoisies([]);
    setExpediteur({
      ...EMPTY_CONTACT,
      nom_prenom: [user?.nom, user?.prenoms].filter(Boolean).join(' '),
      telephone: user?.telephone || '',
    });
    setDestinataire(EMPTY_CONTACT);
    setPickup(EMPTY_PICKUP);
    setDevis(null);
    setOffres(null);
    setDevisStatus('idle');
  };

  // Changer de pays de départ : destinations, produits et agences en dépendent,
  // la sélection en cours est donc repartie à zéro (le mode est conservé).
  const handleChangeCountry = (code) => {
    if (!code || code === country.code) return;
    dispatch(setCountry(code));
    setPaysDestination('');
    setVilleDestination('');
    setCommuneDestinationId('');
    setAgence(null);
    setArticles([]);
    setColisList(isLD ? [{ ...EMPTY_LD_COLIS }] : []);
    setOpenColis(0);
    setTypesChoisis({});
    setOffresChoisies([]);
    setProducts([]);
    setDevis(null);
    setOffres(null);
    setDevisStatus('idle');
    setPickup(EMPTY_PICKUP);
    setStep(1);
    setMaxStepReached(1);
  };

  const handleSelectMode = (value) => {
    if (value === mode) return;
    setMode(value);
    // La source des villes change selon le mode (communes en agence) : on repart de zéro.
    setVilleDestination('');
    setCommuneDestinationId('');
    setDevis(null);
    setOffres(null);
    setDevisStatus('idle');
    setTypesChoisis({});
    setOffresChoisies([]);
    // Drop a destination that isn't tariffed for the new mode (e.g. an LD-only
    // country when switching to groupage) so the devis can't fail silently.
    const dest = destinations.find((d) => d.code_pays === paysDestination);
    if (paysDestination && !isDestinationCompatible(dest, value)) {
      setPaysDestination('');
      setVilleDestination('');
      setCommuneDestinationId('');
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
      .catch((err) => !cancelled && setDestinationsStatus(isUnsupportedCountry(err) ? 'unsupported' : 'error'));
    return () => {
      cancelled = true;
    };
  }, [country.code, destRetry]);

  // Communes du pays de destination (route publique). Optionnel : si la liste est
  // vide ou indisponible, le sélecteur est masqué et la ville texte reste le repli.
  useEffect(() => {
    if (!communeApplicable) {
      setCommunes([]);
      setCommunesStatus('idle');
      return undefined;
    }
    let cancelled = false;
    setCommunesStatus('loading');
    expeditionService
      .listCommunes(paysDestination)
      .then((data) => {
        if (cancelled) return;
        setCommunes(data.communes ?? []);
        setCommunesStatus('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setCommunes([]);
        setCommunesStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [communeApplicable, paysDestination, communesRetry]);

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
      setOffres(null);
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
          // Repli de la ligne DHD si l'agence n'a pas de ville en base (agence.ville prime côté serveur).
          if (villeDepart) payload.ville_depart = villeDepart;
        }
        if (villeRequise) payload.ville_destination = villeDestination;
        if (communeApplicable && communeDestination) payload.destinataire_commune_id = communeDestination.id;
        const data = await expeditionService.getDevis(payload);
        if (cancelled) return;
        setDevis(mode === 'livraison_domicile' ? data.devis ?? null : data.groupes ?? []);
        setOffres(mode === 'livraison_domicile' || !Array.isArray(data.offres) ? null : data.offres);
        setDevisStatus('idle');
      } catch (err) {
        if (cancelled) return;
        const message = isUnsupportedCountry(err)
          ? UNSUPPORTED_DESTINATION_MESSAGE
          : err.response?.data?.message ||
            Object.values(err.response?.data?.errors || {}).flat().join(' ') ||
            'Impossible de calculer le devis pour le moment.';
        setDevis(null);
        setOffres(null);
        setDevisError(message);
        setDevisStatus('error');
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [canComputeDevis, mode, country.code, paysDestination, villeDestination, villeDepart, villeRequise, communeApplicable, communeDestination, agence, articles, colisList, devisRetry]);

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

  // Devis recalculé : on ne garde que les offres cochées encore proposées.
  useEffect(() => {
    if (!Array.isArray(offres)) return;
    setOffresChoisies((prev) => {
      const next = prev.filter((c) => offres.some((o) => o.code === c));
      return next.length === prev.length ? prev : next;
    });
  }, [offres]);

  // Une seule offre possible : elle est retenue d'office (pas de choix à faire).
  useEffect(() => {
    if (Array.isArray(offres) && offres.length === 1) {
      setOffresChoisies((prev) => (prev.length === 1 && prev[0] === offres[0].code ? prev : [offres[0].code]));
    }
  }, [offres]);

  const handleToggleOffre = (code) => setOffresChoisies((prev) => toggleOffre(prev, code, offres || []));

  const handleSelectType = (categoryId, typeExpedition) => {
    setTypesChoisis((prev) => ({ ...prev, [categoryId]: typeExpedition }));
  };

  const addArticle = (product) => {
    setArticles((list) => [...list, {
      produit_id: product.id, designation: product.designation, reference: product.reference, category: product.category?.nom || '',
      is_ca: product.category?.is_default === true || product.category?.is_default === 1, poids: '',
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

  const stepLabels = ['Trajet', isLD ? 'Colis' : 'Articles', 'Expéditeur', 'Destinataire', 'Remise'];

  const groupes = !isLD && Array.isArray(devis) ? devis : [];
  const groupageHasShippableGroup = isLD || !Array.isArray(devis) || devis.some((g) => g.types_eligibles.length > 0);
  const groupageAllChoicesMade =
    isLD || !Array.isArray(devis) || devis.every((g) => g.types_eligibles.length === 0 || Boolean(typesChoisis[g.category_id]));
  const devisReady = devisStatus === 'idle' && (isLD ? Boolean(devis) : Array.isArray(devis));
  // Offres DHD / CA : `types_choisis` = fusion des offres cochées.
  const withOffres = !isLD && Array.isArray(offres);
  const offresCochees = withOffres ? offres.filter((o) => offresChoisies.includes(o.code)) : [];
  const typesFromOffres = offresCochees.reduce((acc, o) => ({ ...acc, ...(o.types_choisis || {}) }), {});
  const typesToSend = withOffres ? typesFromOffres : typesChoisis;
  const categoryNames = Object.fromEntries(groupes.map((g) => [g.category_id, g.category_nom]));
  const poidsHorsCa = articles.filter((a) => !a.is_ca).reduce((sum, a) => sum + (Number(a.poids) || 0), 0);
  // Catégories du panier qu'aucune offre cochée n'envoie : à signaler avant validation.
  const categoriesNonEnvoyees = withOffres && offresCochees.length
    ? groupes.filter((g) => !typesFromOffres[g.category_id]).map((g) => g.category_nom)
    : [];
  const typesKey = JSON.stringify(typesFromOffres);
  const prevuesEnEchec = (devisFinal?.expeditions_prevues ?? []).filter((e) => e?.success === false);
  const finalReady = finalStatus === 'idle' && Boolean(devisFinal) && prevuesEnEchec.length === 0;
  const canContinueContenu = withOffres
    ? contenuOk && devisReady && offresCochees.length > 0 && finalReady
    : contenuOk && devisReady && groupageHasShippableGroup && groupageAllChoicesMade;

  // 2e appel au devis (parcours conseillé, étape 3) : même panier + `types_choisis`
  // fusionné des offres cochées -> prix final à afficher.
  useEffect(() => {
    if (!withOffres || offresChoisies.length === 0 || !canComputeDevis) {
      setDevisFinal(null);
      setFinalStatus('idle');
      return undefined;
    }
    let cancelled = false;
    setFinalStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const payload = {
          mode,
          code_pays_depart: country.code,
          code_pays_destination: paysDestination,
          agence_id: agence.id,
          colis: [{ articles: articles.map((a) => ({ produit_id: a.produit_id, poids: Number(a.poids) })) }],
          types_choisis: JSON.parse(typesKey),
        };
        if (villeDepart) payload.ville_depart = villeDepart;
        if (villeRequise) payload.ville_destination = villeDestination;
        if (communeApplicable && communeDestination) payload.destinataire_commune_id = communeDestination.id;
        const data = await expeditionService.getDevis(payload);
        if (cancelled) return;
        setDevisFinal({ montant_total: data.montant_total ?? null, expeditions_prevues: data.expeditions_prevues ?? [] });
        setFinalStatus('idle');
      } catch (err) {
        if (cancelled) return;
        setDevisFinal(null);
        setFinalError(
          err.response?.data?.message
          || Object.values(err.response?.data?.errors || {}).flat().join(' ')
          || 'Impossible de calculer le prix final pour le moment.'
        );
        setFinalStatus('error');
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withOffres, typesKey, canComputeDevis, mode, country.code, paysDestination, villeDestination, villeDepart, villeRequise, communeApplicable, communeDestination, agence, articles]);

  const destinataireOk = contactIsComplete(destinataire);

  // « Continuer » reste cliquable : si un champ obligatoire manque, on affiche
  // les erreurs et on renvoie sur le premier champ à compléter.
  const [showExpediteurErrors, setShowExpediteurErrors] = useState(false);
  const [showDestinataireErrors, setShowDestinataireErrors] = useState(false);
  const handleContinueExpediteur = () => {
    if (!expediteurOk) {
      setShowExpediteurErrors(true);
      focusFirstInvalid();
      return;
    }
    goToStep(4);
  };
  const handleContinueDestinataire = () => {
    if (!destinataireOk) {
      setShowDestinataireErrors(true);
      focusFirstInvalid();
      return;
    }
    goToStep(5);
  };

  // Étape 5 (« Remise ») -> récapitulatif. Si un contact a été invalidé entre-temps,
  // retour à son étape avec les erreurs.
  const handleVerify = () => {
    if (!expediteurOk) {
      goToStep(3);
      setShowExpediteurErrors(true);
      focusFirstInvalid();
      return;
    }
    if (!destinataireOk) {
      goToStep(4);
      setShowDestinataireErrors(true);
      focusFirstInvalid();
      return;
    }
    setSubmitError('');
    setRecapOpen(true);
  };

  const estimateTotal = computeEstimateTotal(
    mode, devis, typesChoisis, withOffres ? offres : null, offresChoisies, finalReady ? devisFinal.montant_total : null
  );
  const dockStatus = devisStatus === 'loading' || finalStatus === 'loading' ? 'loading' : devisStatus;
  const totalLabel = estimateTotal != null ? fmt(estimateTotal) : null;
  // Total à prévoir : envoi + enlèvement à domicile, quand son tarif est connu.
  const pickupFee = pickup.domicile && pickup.estimate?.total != null ? Number(pickup.estimate.total) : null;
  const grandTotalLabel = estimateTotal != null && pickupFee != null ? fmt(Number(estimateTotal) + pickupFee) : totalLabel;
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
        };
      } else {
        payload = {
          ...base,
          colis: [{
            articles: articles.map((a) => ({ produit_id: a.produit_id, poids: Number(a.poids) })),
          }],
          types_choisis: typesToSend,
        };
      }
      // L'enlèvement intégré au `store` n'existe qu'en LD / Interville : en agence,
      // il est demandé juste après via demander-enlevement (voir plus bas).
      if (isLD) Object.assign(payload, pickupPayload(pickup));
      else if (villeDepart) payload.ville_depart = villeDepart;
      if (villeRequise) payload.ville_destination = villeDestination;
      if (communeApplicable && communeDestination) payload.destinataire_commune_id = communeDestination.id;
      if (!isLD && paiementCredit) payload.is_paiement_credit = true;

      const result = await expeditionService.storeExpedition(payload);
      // En agence : POST /{id}/demander-enlevement après coup, sur la première
      // expédition créée (les colis sont remis ensemble au livreur).
      if (!isLD && pickup.domicile) {
        const created = Array.isArray(result.expeditions) && result.expeditions.length
          ? result.expeditions
          : (result.resultats ?? []).filter((r) => r.success).map((r) => r.expedition);
        const first = created.find((e) => e?.id);
        if (first) {
          try {
            await expeditionService.requestPickup(first.id, missionRequestPayload(pickup));
          } catch (pickupErr) {
            result.pickupError = pickupErr.response?.data?.message
              || "L'enlèvement n'a pas pu être demandé. Vous pouvez le demander depuis le détail de l'expédition.";
          }
        }
      }
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
      const message = isUnsupportedCountry(err)
        ? UNSUPPORTED_DESTINATION_MESSAGE
        : err.response?.data?.message ||
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
    setOffresChoisies([]); // le devis est recalculé : nouvelles offres à choisir
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
        pickupMode={pickup.domicile ? pickup.mode : null}
        pickupEstimate={pickup.domicile ? pickup.estimate : null}
        currency={currency}
        categoryNames={categoryNames}
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
                    <PickerButton
                      icon={Globe2}
                      selected
                      title={`${getFlagEmoji(country.code)}  ${country.name}`}
                      subtitle="Appuyez pour changer de pays"
                      onClick={() => setCountrySheetOpen(true)}
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-surface-700">Destination</p>
                    {destinationsStatus === 'unsupported' ? (
                      <div className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                        <AlertTriangle size={18} className="shrink-0" /> {UNSUPPORTED_DESTINATION_MESSAGE}
                      </div>
                    ) : destinationsStatus === 'error' ? (
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
                  {communeApplicable && (communes.length > 0 || communesStatus === 'loading') ? (
                    // En agence : les villes de destination viennent de l'API des communes.
                    <PickerButton
                      icon={MapPinned}
                      selected={Boolean(villeDestination)}
                      title={villeDestination || (communesStatus === 'loading' ? 'Chargement des villes…' : 'Choisir une ville')}
                      subtitle={villeDestination ? getCountryName(paysDestination) : 'Villes desservies dans ce pays'}
                      onClick={() => setCommuneSheetOpen(true)}
                    />
                  ) : !communeApplicable && cityService.hasCitySearch(paysDestination) ? (
                    <PickerButton
                      icon={Search}
                      selected={Boolean(villeDestination)}
                      title={villeDestination || 'Rechercher une ville'}
                      subtitle={villeDestination ? `${getCountryName(paysDestination)}` : 'Nécessaire hors Afrique'}
                      onClick={() => setCitySheetOpen(true)}
                    />
                  ) : (
                    <>
                      <input
                        id="ville-destination"
                        className="input-field h-14"
                        placeholder="Ex : Marseille"
                        autoComplete="address-level2"
                        value={villeDestination}
                        onChange={(e) => setVilleDestination(e.target.value)}
                      />
                      {communeApplicable && communesStatus === 'error' && (
                        <button type="button" onClick={() => setCommunesRetry((t) => t + 1)} className="mt-1.5 text-xs font-semibold text-primary-600">
                          Liste des villes indisponible · Réessayer
                        </button>
                      )}
                    </>
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
                        <span className="shrink-0 font-heading text-sm font-bold text-primary-700">{fmt(prix)}</span>
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
              <DockTotal label={`Estimation · ${colisList.length} colis`} amount={totalLabel} status={dockStatus} />
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
                          <p className="flex min-w-0 items-center gap-1.5 text-caption text-surface-500">
                            {a.is_ca && <span className="shrink-0 rounded-full bg-shop-100 px-2 py-0.5 font-semibold text-shop-700">CA</span>}
                            <span className="truncate">{a.category || a.reference}</span>
                          </p>
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

              {withOffres && devisStatus !== 'error' && (
                <div className="space-y-2.5 pt-2">
                  <h3 className="font-heading text-[15px] font-semibold text-surface-900">
                    {offres.length === 1 ? 'Votre estimation' : 'Choisissez votre offre'}
                  </h3>
                  {offres.length === 0 ? (
                    <ErrorNote message="Aucun tarif configuré vers cette destination pour ces articles. Modifiez les articles ou la destination." />
                  ) : (
                    <>
                      {offres.length > 1 && (
                      <p className="text-caption text-surface-500">
                        Chaque offre correspond à une expédition et une facture. Vous pouvez cumuler une offre DHD et l’offre Colis Accompagnés ;
                        l’offre combinée regroupe tout le panier en une seule expédition.
                      </p>
                      )}
                      <div className="space-y-2" role="group" aria-label="Offres d'expédition">
                        {offres.map((o) => (
                          <OfferCard
                            key={o.code}
                            offre={o}
                            checked={offresChoisies.includes(o.code)}
                            onToggle={handleToggleOffre}
                            currency={currency}
                            categoryNames={categoryNames}
                            single={offres.length === 1}
                          />
                        ))}
                      </div>
                      {destination?.groupage_dhd_maritime && !offres.some((o) => o.code === 'DHD_MARITIME') && poidsHorsCa > 0 && poidsHorsCa < 50 && (
                        <p className="text-caption text-surface-500">
                          Le DHD Maritime est proposé à partir de 50 kg de produits hors Colis Accompagnés (actuellement {fmtKg(poidsHorsCa)}).
                        </p>
                      )}
                      {finalStatus === 'error' && <ErrorNote message={finalError} />}
                      {prevuesEnEchec.map((e, i) => (
                        <ErrorNote key={i} message={e.message || 'Une des expéditions prévues ne peut pas être créée.'} />
                      ))}
                      {categoriesNonEnvoyees.length > 0 && (
                        <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 p-3 text-caption text-amber-800">
                          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                          <span>Avec cette sélection, ne seront pas envoyés : <strong>{categoriesNonEnvoyees.join(', ')}</strong>.</span>
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {!withOffres && groupes.length > 0 && devisStatus !== 'error' && (
                <div className="space-y-2.5 pt-2">
                  <h3 className="font-heading text-[15px] font-semibold text-surface-900">Mode d'expédition par catégorie</h3>
                  {!groupageHasShippableGroup && groupes.length > 1 && (
                    <ErrorNote message="Aucun tarif pour ces articles vers cette destination. Modifiez les articles ou la destination." />
                  )}
                  {groupes.map((g) => (
                    <GroupTypeChoice key={g.category_id} group={g} chosen={typesChoisis[g.category_id]} onSelect={handleSelectType} currency={currency} />
                  ))}
                </div>
              )}
            </div>

            <ActionDock>
              <DockTotal label="Estimation" amount={totalLabel} status={dockStatus} />
              <button type="button" className="btn-primary h-12 flex-1" disabled={!canContinueContenu} onClick={() => goToStep(3)}>
                {withOffres
                  ? devisReady && offres.length > 0 && offresCochees.length === 0 ? 'Choisir une offre' : 'Continuer'
                  : devisReady && !groupageAllChoicesMade ? 'Choisir les modes' : 'Continuer'}
              </button>
            </ActionDock>
          </>
        )}

        {/* ---------- Étape 3 : Expéditeur ---------- */}
        {step === 3 && (
          <>
            <div className="space-y-3">
              <h2 className="font-heading text-lg font-semibold text-surface-900">Qui envoie le colis ?</h2>
              <ContactFields title="Expéditeur" data={expediteur} onChange={setExpediteur} showErrors={showExpediteurErrors}>
                <IdentityFields data={expediteur} onChange={setExpediteur} showErrors={showExpediteurErrors} />
              </ContactFields>
              {!expediteurOk && (
                <p className="text-caption text-surface-500">Nom, téléphone, adresse et ville sont requis.</p>
              )}
            </div>

            <ActionDock>
              <DockTotal label="Estimation" amount={totalLabel} status={dockStatus} />
              <button type="button" className="btn-primary h-12 flex-1" onClick={handleContinueExpediteur}>
                Continuer
              </button>
            </ActionDock>
          </>
        )}

        {/* ---------- Étape 4 : Destinataire ---------- */}
        {step === 4 && (
          <>
            <div className="space-y-3">
              <h2 className="font-heading text-lg font-semibold text-surface-900">Qui reçoit le colis ?</h2>
              <ContactFields
                title="Destinataire"
                data={destinataire}
                onChange={setDestinataire}
                withLocation={isLD}
                showMap={false}
                postalVisible={isLD}
                postalCountry={paysDestination}
                showErrors={showDestinataireErrors}
                emailHint="Pour recevoir les notifications de suivi du colis, veuillez renseigner l’e-mail du destinataire."
              />
              {!destinataireOk && (
                <p className="text-caption text-surface-500">Nom, téléphone, adresse et ville sont requis.</p>
              )}
            </div>

            <ActionDock>
              <DockTotal label="Estimation" amount={totalLabel} status={dockStatus} />
              <button type="button" className="btn-primary h-12 flex-1" onClick={handleContinueDestinataire}>
                Continuer
              </button>
            </ActionDock>
          </>
        )}

        {/* ---------- Étape 5 : Remise du colis ---------- */}
        {step === 5 && (
          <>
            <div className="space-y-3">
              <h2 className="font-heading text-lg font-semibold text-surface-900">Comment remettre votre colis ?</h2>

              <PickupOption
                value={pickup}
                onChange={setPickup}
                agence={agence}
                communeId={agence?.commune_id}
                currency={currency}
                address={[expediteur.adresse, expediteur.quartier, expediteur.ville].filter((v) => v?.trim()).join(', ')}
              />

              {!isLD && <CreditOption value={paiementCredit} onChange={setPaiementCredit} />}
            </div>

            <ActionDock>
              <DockTotal
                label={pickupFee != null ? 'Estimation · enlèvement inclus' : 'Estimation'}
                detail={pickupFee != null ? `dont enlèvement ${fmt(pickupFee)}` : null}
                amount={grandTotalLabel}
                status={dockStatus}
              />
              <button
                type="button"
                className="btn-primary h-12 flex-1"
                disabled={!canContinueContenu}
                onClick={handleVerify}
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
            <Row
              label="Remise"
              value={pickup.domicile ? `Enlèvement à domicile (${pickup.mode === 'groupage' ? 'retrait classique' : 'récupération express'})` : "Dépôt à l'agence"}
            />
            {pickup.domicile && (
              <Row
                label="Enlèvement (estimé)"
                value={pickup.estimate?.total != null ? fmt(pickup.estimate.total) : 'Confirmé par l’agence'}
              />
            )}
            <Row label="Expéditeur" value={expediteur.nom_prenom} />
            <Row label="Destinataire" value={`${destinataire.nom_prenom} · ${destinataire.telephone}`} />
          </div>

          {withOffres && offresCochees.length > 0 && (
            <div className="space-y-1.5 rounded-xl bg-surface-50 p-3 text-sm">
              {offresCochees.map((o) => (
                <div key={o.code} className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-surface-600">
                    {o.libelle || typeLabel(o.expedition?.type_expedition)}
                    {Number(o.expedition?.montant_remise_promotion) > 0 && (
                      <span className="block text-caption text-emerald-700">Promotion : -{fmt(o.expedition.montant_remise_promotion)}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold text-surface-900">{fmt(o.montant_total)}</span>
                </div>
              ))}
              {categoriesNonEnvoyees.length > 0 && (
                <p className="pt-1 text-caption text-amber-700">Non envoyé : {categoriesNonEnvoyees.join(', ')}.</p>
              )}
            </div>
          )}

          {!withOffres && !isLD && groupes.some((g) => typesChoisis[g.category_id]) && (
            <div className="space-y-1.5 rounded-xl bg-surface-50 p-3 text-sm">
              {groupes.filter((g) => typesChoisis[g.category_id]).map((g) => {
                const t = g.types_eligibles.find((x) => x.type_expedition === typesChoisis[g.category_id]);
                return (
                  <div key={g.category_id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-surface-600">{g.category_nom} · {typeLabel(t?.type_expedition)}</span>
                    <span className="shrink-0 font-semibold text-surface-900">{t ? fmt(t.montant_expedition) : '—'}</span>
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
              <p className="mt-1 text-right text-caption text-primary-700">dont emballage {fmt(emballage)}</p>
            )}
            {pickup.domicile && pickup.estimate?.total != null && estimateTotal != null && (
              <p className="mt-1 text-right text-caption text-primary-700">
                + enlèvement {fmt(pickup.estimate.total)} · total à prévoir {fmt(Number(estimateTotal) + Number(pickup.estimate.total))}
              </p>
            )}
          </div>
          {pickup.domicile && <FeeBreakdown detail={pickup.estimate} currency={currency} hideMajoration />}
          {!isLD && <p className="text-caption text-surface-500">
            La livraison à domicile se demande ensuite depuis le détail de l'expédition : son tarif est calculé selon la distance depuis l'agence d'arrivée et affiché avant confirmation.
          </p>}

          <p className="flex items-start gap-2 text-caption text-surface-500">
            <Globe2 size={14} className="mt-0.5 shrink-0" />
            <span>
              Le montant final est recalculé à l'enregistrement. {pickup.domicile && "L'enlèvement est facturé en plus de l'envoi ; son montant est confirmé à l'enregistrement. "}
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
      <CountrySelectSheet
        open={countrySheetOpen}
        onClose={() => setCountrySheetOpen(false)}
        currentCode={country.code}
        onSelect={handleChangeCountry}
        title="Pays de départ"
        description="Les destinations, produits et agences proposés dépendent du pays de départ."
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
          setCommuneDestinationId('');
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
      <CommuneSelectSheet
        open={communeSheetOpen}
        onClose={() => setCommuneSheetOpen(false)}
        communes={communes}
        status={communesStatus}
        onRetry={() => setCommunesRetry((t) => t + 1)}
        currentId={communeDestinationId}
        onSelect={(c) => {
          setCommuneDestinationId(c.id);
          setVilleDestination(c.nom);
        }}
        title="Ville de destination"
        noun="ville"
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
