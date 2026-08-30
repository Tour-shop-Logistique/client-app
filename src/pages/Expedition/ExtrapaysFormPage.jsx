import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Building2,
  Check,
  ChevronDown,
  Globe2,
  Home,
  MapPinned,
  PackageSearch,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import StepProgress from '../../components/expedition/StepProgress';
import EmptyState from '../../components/common/EmptyState';
import CountrySelectSheet from '../../components/common/CountrySelectSheet';
import CitySelectSheet from '../../components/common/CitySelectSheet';
import AgencySelectSheet from '../../components/expedition/AgencySelectSheet';
import ProductSelectSheet from '../../components/expedition/ProductSelectSheet';
import useRequireAuth from '../../hooks/useRequireAuth';
import expeditionService from '../../services/expeditionService';
import produitService from '../../services/produitService';
import cityService from '../../services/cityService';
import { getCountryName, getFlagEmoji } from '../../utils/countries';
import { isAfricanCountry } from '../../utils/africa';
import { formatPrice } from '../../utils/format';
import { ROUTES, trackingPath } from '../../routes';

const MODES = [
  {
    value: 'livraison_domicile',
    icon: Home,
    label: 'Livraison a domicile',
    hint: 'Devis calcule par colis, selon poids et dimensions',
  },
  {
    value: 'recuperation_agence',
    icon: Building2,
    label: 'Recuperation en agence',
    hint: 'Devis calcule par produit, groupe par categorie',
  },
];

const TYPE_LABELS = {
  groupage_dhd_aerien: 'DHD Aerien',
  groupage_dhd_maritime: 'DHD Maritime',
  groupage_afrique: 'Groupage Afrique',
};

const EMPTY_CONTACT = {
  nom_prenom: '',
  telephone: '',
  email: '',
  adresse: '',
  ville: '',
  societe: '',
  code_postal: '',
  etat: '',
  quartier: '',
};

function typeLabel(type) {
  return TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function emptyToNull(value) {
  const trimmed = (value || '').trim();
  return trimmed ? trimmed : null;
}

// Shared with the interactive groupage selector below so the persistent
// estimate bar always matches what each category's radio buttons show.
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

function EstimateBar({ total, status }) {
  if (status === 'loading') {
    return (
      <div className="mb-4 flex items-center justify-between rounded-xl border border-surface-100 bg-white px-4 py-3 text-sm text-surface-500">
        Calcul de l'estimation...
      </div>
    );
  }
  if (total == null) return null;
  return (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3">
      <span className="text-xs font-medium text-primary-700">Estimation du devis</span>
      <span className="text-base font-bold text-primary-800">{formatPrice(total)}</span>
    </div>
  );
}

function contactIsComplete(data) {
  return Boolean(data.nom_prenom.trim() && data.telephone.trim() && data.adresse.trim() && data.ville.trim());
}

function DevisSummaryGroupage({ status, error, groupes, typesChoisis, onSelectType }) {
  if (status === 'loading') return <p className="text-sm text-surface-500">Calcul du devis...</p>;
  if (status === 'error') return <p className="text-sm text-red-600">{error}</p>;
  if (!groupes) return null;
  if (groupes.length === 0) {
    return <p className="text-sm text-surface-500">Aucune estimation disponible pour cette selection.</p>;
  }

  const total = computeEstimateTotal('recuperation_agence', groupes, typesChoisis) ?? 0;
  const noneShippable = groupes.every((g) => g.types_eligibles.length === 0);

  return (
    <div className="space-y-3">
      <div className="card border border-primary-100 bg-primary-50/60 p-4">
        <p className="text-xs text-primary-700">Estimation totale</p>
        <p className="text-xl font-bold text-primary-800">{formatPrice(total)}</p>
      </div>
      {noneShippable && (
        <p className="text-sm text-red-600">
          Aucun tarif disponible pour cette selection vers cette destination. Modifiez vos articles ou la destination.
        </p>
      )}
      {groupes.map((g) => (
        <div key={g.category_id} className="card p-4 text-sm">
          <p className="font-semibold text-surface-900">{g.category_nom}</p>
          <p className="mb-2 text-xs text-surface-500">{g.poids_total} kg</p>
          {g.types_eligibles.length === 0 ? (
            <p className="text-xs text-surface-400">Aucun tarif disponible pour cette categorie vers cette destination.</p>
          ) : g.types_eligibles.length === 1 ? (
            <div className="flex items-center justify-between">
              <span className="text-surface-600">{typeLabel(g.types_eligibles[0].type_expedition)}</span>
              <span className="font-semibold text-surface-900">{formatPrice(g.types_eligibles[0].montant_expedition)}</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="mb-1 text-xs text-surface-500">Choisissez un mode d'expedition pour cette categorie :</p>
              {g.types_eligibles.map((t) => {
                const selected = typesChoisis[g.category_id] === t.type_expedition;
                return (
                  <button
                    key={t.type_expedition}
                    type="button"
                    onClick={() => onSelectType(g.category_id, t.type_expedition)}
                    className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition ${
                      selected ? 'border-primary-600 bg-primary-50' : 'border-surface-200'
                    }`}
                  >
                    <span className={selected ? 'font-medium text-primary-700' : 'text-surface-600'}>
                      {typeLabel(t.type_expedition)}
                    </span>
                    <span className="font-semibold text-surface-900">{formatPrice(t.montant_expedition)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DevisSummaryLD({ status, error, devis }) {
  if (status === 'loading') return <p className="text-sm text-surface-500">Calcul du devis...</p>;
  if (status === 'error') return <p className="text-sm text-red-600">{error}</p>;
  if (!devis) return null;

  return (
    <div className="space-y-3">
      <div className="card border border-primary-100 bg-primary-50/60 p-4">
        <p className="text-xs text-primary-700">Estimation totale</p>
        <p className="text-xl font-bold text-primary-800">{formatPrice(devis.montant_expedition)}</p>
      </div>
      {devis.details_colis?.length > 1 && (
        <div className="card p-4 text-sm">
          <p className="mb-2 font-semibold text-surface-900">Detail par colis</p>
          <div className="space-y-1.5">
            {devis.details_colis.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-surface-600">Colis {i + 1} · {d.poids} kg</span>
                <span className="font-semibold text-surface-900">{formatPrice(d.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DevisSummary({ mode, status, error, devis, typesChoisis, onSelectType }) {
  if (mode === 'livraison_domicile') return <DevisSummaryLD status={status} error={error} devis={devis} />;
  return (
    <DevisSummaryGroupage status={status} error={error} groupes={devis} typesChoisis={typesChoisis} onSelectType={onSelectType} />
  );
}

function ContactFields({ title, data, onChange }) {
  const [showMore, setShowMore] = useState(false);
  const set = (field) => (e) => onChange({ ...data, [field]: e.target.value });

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <User size={18} className="text-primary-600" />
        <p className="font-semibold text-surface-900">{title}</p>
      </div>
      <label className="block text-sm font-medium text-surface-700">
        Nom et prenom
        <input className="input-field mt-1.5" placeholder="Ex: Jean Kouassi" value={data.nom_prenom} onChange={set('nom_prenom')} />
      </label>
      <label className="block text-sm font-medium text-surface-700">
        Telephone
        <input className="input-field mt-1.5" placeholder="Ex: 0102030405" value={data.telephone} onChange={set('telephone')} />
      </label>
      <label className="block text-sm font-medium text-surface-700">
        Adresse
        <input className="input-field mt-1.5" placeholder="Ex: Rue 12" value={data.adresse} onChange={set('adresse')} />
      </label>
      <label className="block text-sm font-medium text-surface-700">
        Ville
        <input className="input-field mt-1.5" placeholder="Ex: Bouake" value={data.ville} onChange={set('ville')} />
      </label>
      <button type="button" onClick={() => setShowMore((v) => !v)} className="text-xs font-semibold text-primary-600">
        {showMore ? 'Masquer les champs optionnels' : '+ Email, societe, code postal...'}
      </button>
      {showMore && (
        <div className="space-y-3 border-t border-surface-100 pt-3">
          <label className="block text-sm font-medium text-surface-700">
            Email (optionnel)
            <input type="email" className="input-field mt-1.5" value={data.email} onChange={set('email')} />
          </label>
          <label className="block text-sm font-medium text-surface-700">
            Societe (optionnel)
            <input className="input-field mt-1.5" value={data.societe} onChange={set('societe')} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-surface-600">
              Code postal
              <input className="input-field mt-1.5" value={data.code_postal} onChange={set('code_postal')} />
            </label>
            <label className="block text-xs font-medium text-surface-600">
              Etat / Region
              <input className="input-field mt-1.5" value={data.etat} onChange={set('etat')} />
            </label>
          </div>
          <label className="block text-sm font-medium text-surface-700">
            Quartier (optionnel)
            <input className="input-field mt-1.5" value={data.quartier} onChange={set('quartier')} />
          </label>
        </div>
      )}
    </div>
  );
}

function SubmitResultScreen({ result, onNewExpedition }) {
  const navigate = useNavigate();
  const isGroupage = Array.isArray(result.resultats);
  const successes = isGroupage ? result.resultats.filter((r) => r.success) : result.expedition ? [{ expedition: result.expedition }] : [];
  const failures = isGroupage ? result.resultats.filter((r) => !r.success) : [];

  return (
    <div>
      <TopBar title="Expedition Extrapays" />
      <div className="page-container space-y-4 py-4">
        <div className="card flex flex-col items-center gap-2 border border-primary-100 bg-primary-50/60 p-6 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white">
            <Check size={28} />
          </span>
          <p className="text-base font-bold text-surface-900">{result.message}</p>
        </div>

        {successes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-surface-700">Demande(s) enregistree(s)</p>
            {successes.map(({ expedition: exp }) => (
              <button
                key={exp.id}
                type="button"
                onClick={() => navigate(trackingPath(exp.id))}
                className="card flex w-full items-center justify-between p-4 text-left"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-surface-900">{exp.reference}</p>
                  <p className="text-xs text-surface-500">{typeLabel(exp.type_expedition)}</p>
                </div>
                <span className="shrink-0 font-semibold text-primary-700">{formatPrice(exp.montant_expedition)}</span>
              </button>
            ))}
          </div>
        )}

        {failures.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-red-600">Non enregistree(s)</p>
            {failures.map((f, i) => (
              <div key={i} className="card border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                {f.message}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => navigate(ROUTES.EXPEDITION_HISTORY)}>
            Mes expeditions
          </button>
          <button type="button" className="btn-primary flex-1" onClick={onNewExpedition}>
            Nouvelle expedition
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExtrapaysFormPage() {
  const { requireAuth } = useRequireAuth();
  const country = useSelector((state) => state.country);
  const user = useSelector((state) => state.auth.user);

  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitResult, setSubmitResult] = useState(null);

  const [countrySheetOpen, setCountrySheetOpen] = useState(!country.code);
  const [destSheetOpen, setDestSheetOpen] = useState(false);
  const [citySheetOpen, setCitySheetOpen] = useState(false);
  const [agenceSheetOpen, setAgenceSheetOpen] = useState(false);
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [productTargetColisIndex, setProductTargetColisIndex] = useState(null); // null = mode groupage, number = index colis LD

  const [mode, setMode] = useState('');
  const [paysDestination, setPaysDestination] = useState('');
  const [villeDestination, setVilleDestination] = useState('');
  const [articles, setArticles] = useState([]); // groupage: { produit_id, designation, reference, poids }
  const [colisList, setColisList] = useState([]); // LD: { poids, longueur, largeur, hauteur, articles: [{produit_id, designation, reference}] }
  const [agence, setAgence] = useState(null);
  const [typesChoisis, setTypesChoisis] = useState({}); // groupage: { category_id: type_expedition }
  const [expediteur, setExpediteur] = useState(EMPTY_CONTACT);
  const [destinataire, setDestinataire] = useState(EMPTY_CONTACT);

  const [products, setProducts] = useState([]);
  const [productsStatus, setProductsStatus] = useState('idle');

  const [devis, setDevis] = useState(null);
  const [devisStatus, setDevisStatus] = useState('idle');
  const [devisError, setDevisError] = useState('');

  const destinationIsAfrican = isAfricanCountry(paysDestination);
  // Ville de destination is asked for both modes as soon as the destination
  // isn't an African country — same rule as recuperation_agence, now also
  // applied to livraison_domicile.
  const villeRequise = Boolean(paysDestination) && !destinationIsAfrican;

  useEffect(() => {
    if (!user) return;
    setExpediteur((e) => (e.nom_prenom || e.telephone ? e : { ...e, nom_prenom: user.name || '', telephone: user.phone || '' }));
  }, [user]);

  // Used by both the "Continuer"/"Retour" buttons and the clickable step
  // trail (StepProgress) so users can jump back to any section they already
  // filled in, not just walk back one step at a time.
  const goToStep = (n) => {
    setStep(n);
    setMaxStepReached((m) => Math.max(m, n));
  };

  const resetForm = () => {
    setStep(1);
    setMaxStepReached(1);
    setSubmitResult(null);
    setSubmitError('');
    setMode('');
    setPaysDestination('');
    setVilleDestination('');
    setArticles([]);
    setColisList([]);
    setAgence(null);
    setTypesChoisis({});
    setExpediteur({ ...EMPTY_CONTACT, nom_prenom: user?.name || '', telephone: user?.phone || '' });
    setDestinataire(EMPTY_CONTACT);
    setDevis(null);
    setDevisStatus('idle');
  };

  const handleSelectMode = (value) => {
    if (value === mode) return;
    setMode(value);
    setDevis(null);
    setDevisStatus('idle');
    setTypesChoisis({});
    if (value === 'livraison_domicile') {
      setArticles([]);
      setColisList((list) => (list.length ? list : [{ poids: '', longueur: '', largeur: '', hauteur: '', articles: [] }]));
    } else {
      setColisList([]);
    }
  };

  useEffect(() => {
    if (!country.code || !mode) return;
    setProductsStatus('loading');
    const params = mode === 'livraison_domicile' ? { code_pays: country.code, eligible_ld: 1 } : { code_pays: country.code };
    produitService
      .list(params)
      .then((data) => {
        setProducts(data.products ?? []);
        setProductsStatus('idle');
      })
      .catch(() => setProductsStatus('error'));
  }, [country.code, mode]);

  const canComputeDevis =
    mode === 'livraison_domicile'
      ? country.code && paysDestination && (!villeRequise || villeDestination) && agence?.id && colisList.length > 0 && colisList.every((c) => Number(c.poids) > 0)
      : country.code && paysDestination && (!villeRequise || villeDestination) && articles.length > 0 && agence?.id;

  useEffect(() => {
    if (!canComputeDevis) {
      setDevis(null);
      setDevisStatus('idle');
      return;
    }
    const timer = setTimeout(async () => {
      setDevisStatus('loading');
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
        setDevis(mode === 'livraison_domicile' ? data.devis ?? null : data.groupes ?? []);
        setDevisStatus('idle');
      } catch (err) {
        const message =
          err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(' ') ||
          'Impossible de calculer le devis pour le moment.';
        setDevisError(message);
        setDevisStatus('error');
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [canComputeDevis, mode, country.code, paysDestination, villeDestination, villeRequise, agence, articles, colisList]);

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
    setArticles((list) => [...list, { produit_id: product.id, designation: product.designation, reference: product.reference, poids: '' }]);
  };
  const updateArticlePoids = (index, poids) => {
    setArticles((list) => list.map((a, i) => (i === index ? { ...a, poids } : a)));
  };
  const removeArticle = (index) => {
    setArticles((list) => list.filter((_, i) => i !== index));
  };

  const addColis = () => setColisList((list) => [...list, { poids: '', longueur: '', largeur: '', hauteur: '', articles: [] }]);
  const removeColis = (index) => setColisList((list) => list.filter((_, i) => i !== index));
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
    if (mode === 'livraison_domicile') {
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

  const availableProducts =
    mode === 'livraison_domicile'
      ? products.filter((p) => !(colisList[productTargetColisIndex]?.articles ?? []).some((a) => a.produit_id === p.id))
      : products.filter((p) => !articles.some((a) => a.produit_id === p.id));

  const stepLabels =
    mode === 'livraison_domicile'
      ? ['Mode', 'Destination', 'Colis', 'Agence', 'Coordonnees', 'Recapitulatif']
      : ['Mode', 'Destination', 'Articles', 'Agence', 'Coordonnees', 'Recapitulatif'];

  const canContinueStep1 = Boolean(mode);
  const canContinueStep2 = Boolean(paysDestination) && (!villeRequise || villeDestination);
  const canContinueStep3 =
    mode === 'livraison_domicile'
      ? colisList.length > 0 && colisList.every((c) => Number(c.poids) > 0)
      : articles.length > 0 && articles.every((a) => Number(a.poids) > 0);

  const groupageHasShippableGroup = mode !== 'recuperation_agence' || !Array.isArray(devis) || devis.some((g) => g.types_eligibles.length > 0);
  const groupageAllChoicesMade =
    mode !== 'recuperation_agence' || !Array.isArray(devis) || devis.every((g) => g.types_eligibles.length === 0 || Boolean(typesChoisis[g.category_id]));
  const canContinueStep4 = Boolean(agence) && groupageHasShippableGroup && groupageAllChoicesMade;

  const canContinueStep5 = contactIsComplete(expediteur) && contactIsComplete(destinataire);

  const estimateTotal = computeEstimateTotal(mode, devis, typesChoisis);

  const handleSubmit = () => {
    requireAuth(async () => {
      setSubmitting(true);
      setSubmitError('');
      try {
        const contactFields = (prefix, data) => ({
          [`${prefix}_nom_prenom`]: data.nom_prenom.trim(),
          [`${prefix}_telephone`]: data.telephone.trim(),
          [`${prefix}_email`]: emptyToNull(data.email),
          [`${prefix}_adresse`]: data.adresse.trim(),
          [`${prefix}_ville`]: data.ville.trim(),
          [`${prefix}_societe`]: emptyToNull(data.societe),
          [`${prefix}_code_postal`]: emptyToNull(data.code_postal),
          [`${prefix}_etat`]: emptyToNull(data.etat),
          [`${prefix}_quartier`]: emptyToNull(data.quartier),
        });

        const base = {
          mode,
          code_pays_depart: country.code,
          code_pays_destination: paysDestination,
          agence_id: agence.id,
          ...contactFields('expediteur', expediteur),
          ...contactFields('destinataire', destinataire),
        };

        let payload;
        if (mode === 'livraison_domicile') {
          payload = {
            ...base,
            colis: colisList.map((c) => ({
              poids: Number(c.poids),
              longueur: Number(c.longueur) || 0,
              largeur: Number(c.largeur) || 0,
              hauteur: Number(c.hauteur) || 0,
              prix_emballage: 0,
              articles: c.articles.map((a) => ({ produit_id: a.produit_id })),
            })),
          };
        } else {
          payload = {
            ...base,
            colis: [{ articles: articles.map((a) => ({ produit_id: a.produit_id, poids: Number(a.poids) })) }],
            types_choisis: typesChoisis,
          };
        }
        if (villeRequise) payload.ville_destination = villeDestination;

        const result = await expeditionService.storeExpedition(payload);
        setSubmitResult(result);
      } catch (err) {
        const message =
          err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(' ') ||
          "Impossible d'enregistrer l'expedition pour le moment.";
        setSubmitError(message);
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    }, 'expedition');
  };

  if (submitResult) {
    return <SubmitResultScreen result={submitResult} onNewExpedition={resetForm} />;
  }

  if (!country.code) {
    return (
      <div>
        <TopBar title="Expedition Extrapays" back />
        <div className="page-container py-4">
          <EmptyState
            icon={MapPinned}
            title="Choisissez votre pays de depart"
            description="Selectionnez votre pays pour voir les agences et produits disponibles."
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
      <TopBar title="Expedition Extrapays" back />
      <div className="page-container py-4">
        <StepProgress
          step={step}
          total={6}
          labels={stepLabels}
          onStepClick={goToStep}
          maxStepReached={maxStepReached}
        />
        {step >= 4 && <EstimateBar total={estimateTotal} status={devisStatus} />}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-surface-500">Comment souhaitez-vous expedier votre colis ?</p>
            <div className="space-y-3">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleSelectMode(m.value)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    mode === m.value ? 'border-primary-600 bg-primary-50' : 'border-surface-200 bg-white'
                  }`}
                >
                  <span
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      mode === m.value ? 'bg-white text-primary-600' : 'bg-surface-100 text-surface-500'
                    }`}
                  >
                    <m.icon size={20} />
                  </span>
                  <div>
                    <p className="font-semibold text-surface-900">{m.label}</p>
                    <p className="text-xs text-surface-500">{m.hint}</p>
                  </div>
                </button>
              ))}
            </div>
            <button type="button" className="btn-primary w-full" disabled={!canContinueStep1} onClick={() => goToStep(2)}>
              Continuer
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-surface-500">
              Depart depuis {getFlagEmoji(country.code)} {country.name}
            </p>
            <div>
              <p className="mb-1.5 text-sm font-medium text-surface-700">Pays de destination</p>
              <button
                type="button"
                onClick={() => setDestSheetOpen(true)}
                className="input-field flex items-center justify-between text-left"
              >
                <span className={`flex items-center gap-2 ${paysDestination ? 'text-surface-900' : 'text-surface-400'}`}>
                  {paysDestination && <span className="text-lg leading-none">{getFlagEmoji(paysDestination)}</span>}
                  {paysDestination ? getCountryName(paysDestination) : 'Choisir un pays'}
                </span>
                <ChevronDown size={16} className="text-surface-400" />
              </button>
            </div>
            {villeRequise && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-surface-700">Ville de destination</p>
                {cityService.hasCitySearch(paysDestination) ? (
                  <button
                    type="button"
                    onClick={() => setCitySheetOpen(true)}
                    className="input-field flex items-center justify-between text-left"
                  >
                    <span className={villeDestination ? 'text-surface-900' : 'text-surface-400'}>
                      {villeDestination || 'Rechercher une ville'}
                    </span>
                    <ChevronDown size={16} className="text-surface-400" />
                  </button>
                ) : (
                  <input
                    className="input-field"
                    placeholder="Ex: Marseille"
                    value={villeDestination}
                    onChange={(e) => setVilleDestination(e.target.value)}
                  />
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => goToStep(1)}>Retour</button>
              <button type="button" className="btn-primary flex-1" disabled={!canContinueStep2} onClick={() => goToStep(3)}>Continuer</button>
            </div>
          </div>
        )}

        {step === 3 && mode === 'recuperation_agence' && (
          <div className="space-y-4">
            {articles.length === 0 && (
              <EmptyState
                icon={PackageSearch}
                title="Aucun article ajoute"
                description="Ajoutez les produits que vous souhaitez expedier."
              />
            )}
            {articles.map((a, i) => (
              <div key={`${a.produit_id}-${i}`} className="card flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-surface-900">{a.designation}</p>
                  <p className="text-xs text-surface-500">{a.reference}</p>
                </div>
                <input
                  type="number"
                  min="0.01"
                  step="0.1"
                  placeholder="kg"
                  className="input-field w-20 text-center"
                  value={a.poids}
                  onChange={(e) => updateArticlePoids(i, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeArticle(i)}
                  className="rounded-full p-2 text-surface-400 hover:bg-surface-100 hover:text-red-600"
                  aria-label="Retirer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={openProductSheetForGroupage}
              className="card flex w-full items-center justify-center gap-2 p-4 text-sm font-semibold text-primary-600"
            >
              <Plus size={18} /> Ajouter un produit
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => goToStep(2)}>Retour</button>
              <button type="button" className="btn-primary flex-1" disabled={!canContinueStep3} onClick={() => goToStep(4)}>Continuer</button>
            </div>
          </div>
        )}

        {step === 3 && mode === 'livraison_domicile' && (
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
                    onChange={(e) => updateColisField(i, 'poids', e.target.value)}
                  />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block text-xs font-medium text-surface-600">
                    Longueur (cm)
                    <input type="number" min="0" className="input-field mt-1.5" value={c.longueur} onChange={(e) => updateColisField(i, 'longueur', e.target.value)} />
                  </label>
                  <label className="block text-xs font-medium text-surface-600">
                    Largeur (cm)
                    <input type="number" min="0" className="input-field mt-1.5" value={c.largeur} onChange={(e) => updateColisField(i, 'largeur', e.target.value)} />
                  </label>
                  <label className="block text-xs font-medium text-surface-600">
                    Hauteur (cm)
                    <input type="number" min="0" className="input-field mt-1.5" value={c.hauteur} onChange={(e) => updateColisField(i, 'hauteur', e.target.value)} />
                  </label>
                </div>
                {c.articles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.articles.map((a, ai) => (
                      <span key={ai} className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-1 text-xs text-surface-700">
                        {a.designation}
                        <button type="button" onClick={() => removeColisArticle(i, ai)} aria-label="Retirer">
                          <Trash2 size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openProductSheetForColis(i)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-surface-300 py-2.5 text-sm font-medium text-primary-600"
                >
                  <Plus size={16} /> Ajouter un produit (optionnel)
                </button>
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
              <button type="button" className="btn-secondary flex-1" onClick={() => goToStep(2)}>Retour</button>
              <button type="button" className="btn-primary flex-1" disabled={!canContinueStep3} onClick={() => goToStep(4)}>Continuer</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
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
            </div>
            {canComputeDevis && (
              <DevisSummary
                mode={mode}
                status={devisStatus}
                error={devisError}
                devis={devis}
                typesChoisis={typesChoisis}
                onSelectType={handleSelectType}
              />
            )}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => goToStep(3)}>Retour</button>
              <button type="button" className="btn-primary flex-1" disabled={!canContinueStep4} onClick={() => goToStep(5)}>Continuer</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-surface-500">Qui expedie et qui reçoit ce colis ?</p>
            <ContactFields title="Expediteur" data={expediteur} onChange={setExpediteur} />
            <ContactFields title="Destinataire" data={destinataire} onChange={setDestinataire} />
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => goToStep(4)}>Retour</button>
              <button type="button" className="btn-primary flex-1" disabled={!canContinueStep5} onClick={() => goToStep(6)}>Continuer</button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <div className="card divide-y divide-surface-100 p-4 text-sm">
              <Row label="Mode" value={mode === 'livraison_domicile' ? 'Livraison a domicile' : 'Recuperation en agence'} />
              <Row
                label="Trajet"
                value={`${getFlagEmoji(country.code)} ${country.name} → ${getFlagEmoji(paysDestination)} ${getCountryName(paysDestination)}${villeDestination ? `, ${villeDestination}` : ''}`}
              />
              <Row
                label={mode === 'livraison_domicile' ? 'Colis' : 'Articles'}
                value={mode === 'livraison_domicile' ? `${colisList.length} colis` : `${articles.length} produit(s)`}
              />
              <Row label="Agence de depart" value={agence?.nom_agence} />
              <Row label="Expediteur" value={`${expediteur.nom_prenom} · ${expediteur.telephone}`} />
              <Row label="Destinataire" value={`${destinataire.nom_prenom} · ${destinataire.telephone}`} />
            </div>

            <DevisSummary
              mode={mode}
              status={devisStatus}
              error={devisError}
              devis={devis}
              typesChoisis={typesChoisis}
              onSelectType={handleSelectType}
            />

            <p className="flex items-center gap-1.5 text-xs text-surface-400">
              <Globe2 size={14} /> Suivi disponible a chaque etape du transit international.
            </p>

            {submitError && (
              <div className="card border border-red-100 bg-red-50 p-3 text-sm text-red-700">{submitError}</div>
            )}

            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => goToStep(5)}>Retour</button>
              <button type="button" className="btn-primary flex-1" disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Envoi...' : "Confirmer l'expedition"}
              </button>
            </div>
          </div>
        )}
      </div>

      <CountrySelectSheet
        open={destSheetOpen}
        onClose={() => setDestSheetOpen(false)}
        currentCode={paysDestination}
        onSelect={(code) => {
          setPaysDestination(code);
          setVilleDestination('');
        }}
        title="Pays de destination"
        description="Selectionnez le pays vers lequel vous souhaitez expedier votre colis."
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

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-surface-500">{label}</span>
      <span className={strong ? 'font-semibold text-primary-700' : 'font-medium text-surface-900'}>{value}</span>
    </div>
  );
}
