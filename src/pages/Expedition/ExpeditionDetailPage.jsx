import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowRight,
  Package,
  User,
  MapPin,
  Building2,
  Boxes,
  Ban,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import BottomSheet from '../../components/common/BottomSheet';
import expeditionService from '../../services/expeditionService';
import { cancelExpedition, resetCancelState } from '../../store/slices/expeditionSlice';
import { formatDate, formatDateTime, formatPrice } from '../../utils/format';
import { getStatutMeta, getTypeLabel, isCancelable } from '../../utils/expeditionStatus';
import { ROUTES } from '../../routes';

const val = (v) => (v === null || v === undefined || v === '' ? null : v);

// L'API renvoie soit un objet imbriqué `expediteur: { ... }`, soit des champs
// plats `expediteur_nom_prenom`, etc. — on gère les deux.
const contact = (exp, who) => {
  const nested = exp?.[who];
  const flat = (k) => exp?.[`${who}_${k}`];
  const get = (k) => val(nested?.[k]) ?? val(flat(k));
  return {
    nom: get('nom_prenom'),
    telephone: get('telephone'),
    email: get('email'),
    adresse: get('adresse'),
    ville: get('ville'),
    quartier: get('quartier'),
    codePostal: get('code_postal'),
    societe: get('societe'),
    etat: get('etat'),
  };
};

function Section({ icon, title, children, right }) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary-600">
          {icon}
          <h2 className="text-sm font-semibold text-surface-900">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }) {
  if (!val(value)) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-surface-500">{label}</span>
      <span className="text-right font-medium text-surface-800">{value}</span>
    </div>
  );
}

function ContactBlock({ person }) {
  const lines = [
    person.societe,
    person.adresse,
    [person.quartier, person.ville].filter(Boolean).join(', '),
    [person.codePostal, person.etat].filter(Boolean).join(' '),
  ].filter((l) => val(l));

  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold text-surface-900">{person.nom || '—'}</p>
      {person.telephone && <p className="text-surface-600">{person.telephone}</p>}
      {person.email && <p className="text-surface-600">{person.email}</p>}
      {lines.length > 0 && (
        <p className="text-surface-500">{lines.join(' · ')}</p>
      )}
    </div>
  );
}

function ColisItem({ colis, index }) {
  const dims = [colis.longueur, colis.largeur, colis.hauteur].map(Number);
  const hasDims = dims.some((d) => d > 0);
  const articles = colis.articles ?? [];
  return (
    <div className="rounded-xl border border-surface-100 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-surface-900">
          {colis.code_colis || `Colis ${index + 1}`}
        </p>
        {val(colis.poids) && (
          <span className="text-xs font-medium text-surface-600">{colis.poids} kg</span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-surface-500">
        {hasDims && <span>{dims.map((d) => d || 0).join(' × ')} cm</span>}
        {Number(colis.prix_emballage) > 0 && (
          <span>Emballage : {formatPrice(colis.prix_emballage)}</span>
        )}
        {articles.length > 0 && <span>{articles.length} article(s)</span>}
      </div>
    </div>
  );
}

export default function ExpeditionDetailPage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { cancelStatus, cancelError } = useSelector((state) => state.expeditions);

  const [exp, setExp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [motif, setMotif] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotFound(false);
    expeditionService
      .clientShow(id)
      .then((res) => {
        if (alive) setExp(res.data ?? res);
      })
      .catch(() => {
        if (alive) setNotFound(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const openSheet = () => {
    dispatch(resetCancelState());
    setMotif('');
    setSheetOpen(true);
  };
  const closeSheet = () => {
    setSheetOpen(false);
    setMotif('');
    dispatch(resetCancelState());
  };

  const handleCancel = async () => {
    if (motif.trim().length < 3) {
      toast.error('Indiquez un motif (3 caractères minimum).');
      return;
    }
    const result = await dispatch(cancelExpedition({ id, motif: motif.trim() }));
    if (!cancelExpedition.fulfilled.match(result)) return;
    setExp((prev) => ({ ...prev, ...result.payload }));
    toast.success('Expédition annulée.');
    closeSheet();
  };

  if (loading) {
    return (
      <div>
        <TopBar title="Détail de l'expédition" back />
        <LoadingSpinner label="Chargement du détail..." />
      </div>
    );
  }

  if (notFound || !exp) {
    return (
      <div>
        <TopBar title="Détail de l'expédition" back />
        <div className="page-container py-10">
          <EmptyState
            icon={AlertTriangle}
            title="Expédition introuvable"
            description="Cette demande n'existe pas ou ne vous appartient pas."
            action={
              <Link to={ROUTES.EXPEDITION_HISTORY} className="btn-primary">
                Retour à mes colis
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const rawStatut = exp.statut_expedition ?? exp.statut ?? exp.statut_colis;
  const statut = getStatutMeta(rawStatut);
  const cancelable = isCancelable(rawStatut);
  const alreadyClosed = ['cancelled', 'refused', 'termined'].includes(rawStatut);
  const expediteur = contact(exp, 'expediteur');
  const destinataire = contact(exp, 'destinataire');
  const villeDep = val(expediteur.ville) || val(exp.ville_depart) || val(exp.agence?.ville);
  const villeDest = val(destinataire.ville) || val(exp.ville_destination);
  const colis = exp.colis ?? [];

  return (
    <div>
      <TopBar title="Détail de l'expédition" back />

      <div className="page-container space-y-3 py-4">
        {/* En-tête */}
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-br from-primary-600 to-primary-700 p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-white/70">Référence</p>
                <p className="truncate text-lg font-bold">{exp.reference || '—'}</p>
              </div>
              <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
                {statut.label}
              </span>
            </div>
            <p className="mt-3 text-2xl font-extrabold">{formatPrice(exp.montant_expedition)}</p>
            <p className="text-xs text-white/70">
              {getTypeLabel(exp.type_expedition)} · créée le {formatDate(exp.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-2 p-4 text-sm font-medium text-surface-800">
            <MapPin size={15} className="shrink-0 text-surface-400" />
            <span className="truncate">{villeDep || exp.code_pays_depart || '—'}</span>
            <ArrowRight size={15} className="shrink-0 text-surface-400" />
            <span className="truncate">{villeDest || exp.code_pays_destination || '—'}</span>
          </div>
        </div>

        {rawStatut === 'cancelled' && (
          <div className="card border border-red-100 bg-red-50/50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <Ban size={15} /> Demande annulée
            </div>
            {val(exp.motif_annulation) && (
              <p className="mt-1 text-sm text-red-600">Motif : {exp.motif_annulation}</p>
            )}
            {val(exp.date_annulation) && (
              <p className="mt-0.5 text-xs text-red-500">Le {formatDateTime(exp.date_annulation)}</p>
            )}
          </div>
        )}

        <Section icon={<Building2 size={16} />} title="Agence de départ">
          <p className="text-sm font-semibold text-surface-900">
            {exp.agence?.nom_agence || '—'}
          </p>
          {val(exp.agence?.ville) && (
            <p className="text-sm text-surface-500">
              {[exp.agence.adresse, exp.agence.ville, exp.agence.pays].filter(Boolean).join(', ')}
            </p>
          )}
        </Section>

        <Section icon={<User size={16} />} title="Expéditeur">
          <ContactBlock person={expediteur} />
        </Section>

        <Section icon={<MapPin size={16} />} title="Destinataire">
          <ContactBlock person={destinataire} />
        </Section>

        <Section
          icon={<Boxes size={16} />}
          title="Colis"
          right={<span className="text-xs text-surface-500">{colis.length} colis</span>}
        >
          {colis.length === 0 ? (
            <p className="text-sm text-surface-500">Aucun détail de colis.</p>
          ) : (
            <div className="space-y-2">
              {colis.map((c, i) => (
                <ColisItem key={c.code_colis || i} colis={c} index={i} />
              ))}
            </div>
          )}
        </Section>

        <Section icon={<Package size={16} />} title="Récapitulatif">
          <div className="divide-y divide-surface-100">
            <Row label="Type" value={getTypeLabel(exp.type_expedition)} />
            <Row label="Statut" value={statut.label} />
            <Row label="Montant" value={formatPrice(exp.montant_expedition)} />
            <Row
              label="Paiement"
              value={exp.statut_paiement === 'paye' ? 'Payé' : val(exp.statut_paiement) ? 'Non payé' : null}
            />
            <Row label="Créée le" value={formatDateTime(exp.created_at)} />
          </div>
        </Section>

        {cancelable && (
          <button
            type="button"
            className="btn-secondary w-full border-red-200 text-red-600"
            onClick={openSheet}
          >
            <Ban size={16} /> Annuler cette demande
          </button>
        )}

        {!cancelable && !alreadyClosed && (
          <p className="rounded-xl bg-surface-100 px-3 py-2.5 text-center text-xs text-surface-500">
            Cette demande est en cours de traitement et ne peut plus être annulée.
          </p>
        )}
      </div>

      <BottomSheet open={sheetOpen} onClose={closeSheet} title="Annuler l'expédition">
        <div className="space-y-3">
          <p className="text-sm text-surface-500">
            Cette action annule définitivement la demande {exp.reference}. Elle n'est possible que
            tant que l'agence ne l'a pas traitée.
          </p>
          <label className="block text-sm font-medium text-surface-700">
            Motif de l'annulation
            <textarea
              rows={3}
              maxLength={500}
              className="input-field mt-1.5"
              placeholder="Ex: erreur sur l'adresse du destinataire"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              autoFocus
            />
          </label>
          {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={cancelStatus === 'loading'}
            onClick={handleCancel}
          >
            {cancelStatus === 'loading' ? 'Annulation…' : "Confirmer l'annulation"}
          </button>
          <button type="button" className="btn-ghost w-full" onClick={closeSheet}>
            Retour
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
