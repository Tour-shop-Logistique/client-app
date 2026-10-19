import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ChevronRight, Inbox, Loader2, PackageOpen, RefreshCw, Search,
} from 'lucide-react';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ExpeditionStatusBadge from '../../components/expedition/ExpeditionStatusBadge';
import destinataireService from '../../services/destinataireService';
import { openAuthSheet } from '../../store/slices/uiSlice';
import { apiErrorMessage } from '../../utils/marketplace';
import { formatDate } from '../../utils/format';
import { villeDepart, villeDestination } from '../../utils/expeditionStatus';
import { rememberReceived, canRequestHomeDelivery } from '../../utils/received';
import { receivedDetailPath } from '../../routes';

// « Colis reçus » : expéditions dont l'utilisateur est le destinataire
// (rapprochement par compte ou par téléphone), et recherche par référence
// reçue par e-mail / SMS (user-parcour/CHANGEMENTS_APPS_CLIENT_LIVREUR.md §4).

function ReceivedCard({ exp }) {
  const from = exp.pays_depart || villeDepart(exp);
  const to = exp.agence_arrivee?.ville || exp.pays_destination || villeDestination(exp);
  return (
    <Link
      to={receivedDetailPath(exp.id)}
      className="group flex items-stretch gap-3 rounded-2xl bg-white p-4 shadow-card transition active:scale-[0.99]"
    >
      <span className="icon-tile h-11 w-11 self-start rounded-[14px] bg-orange-100 text-amber-700">
        <PackageOpen size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-surface-900">{exp.reference || 'Colis'}</p>
          <ExpeditionStatusBadge statut={exp.statut_expedition} />
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-surface-700">
          <span className="truncate">{from}</span>
          <ArrowRight size={13} className="shrink-0 text-primary-400" />
          <span className="truncate">{to}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-surface-600">
          {exp.created_at && <span className="rounded-full bg-surface-100 px-2 py-0.5">{formatDate(exp.created_at)}</span>}
          {exp.is_livraison_domicile && <span className="rounded-full bg-primary-50 px-2 py-0.5 text-primary-700">Livraison à domicile</span>}
          {canRequestHomeDelivery(exp) && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">Livrable chez vous</span>}
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 self-center text-surface-300 transition group-hover:text-surface-500" />
    </Link>
  );
}

function SearchByCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const exp = await destinataireService.search(code);
      if (!exp?.id) {
        setError('Aucune expédition ne correspond à ce code.');
        return;
      }
      rememberReceived(exp);
      navigate(receivedDetailPath(exp.id));
    } catch (err) {
      setError(err.response?.status === 404
        ? 'Aucune expédition ne correspond à ce code.'
        : apiErrorMessage(err, 'Recherche impossible pour le moment.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-2 p-4">
      <label htmlFor="code-colis" className="text-sm font-semibold text-surface-900">Suivre un colis avec sa référence</label>
      <p className="text-xs text-surface-500">La référence vous a été envoyée par e-mail ou SMS (ex : TS-ABJ-00123).</p>
      <div className="flex gap-2">
        <input
          id="code-colis"
          className="input-field flex-1 uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="TS-ABJ-00123"
          autoComplete="off"
          autoCapitalize="characters"
        />
        <button type="submit" className="btn-primary shrink-0 px-4" disabled={busy || !code.trim()} aria-label="Rechercher">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        </button>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </form>
  );
}

export default function ReceivedListPage() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [error, setError] = useState(null);

  const load = useCallback(async (p = 1) => {
    setStatus('loading');
    setError(null);
    try {
      const res = await destinataireService.myShipments(p);
      rememberReceived(res.items);
      setItems((prev) => (p > 1 ? [...prev, ...res.items] : res.items));
      setPage(res.page);
      setLastPage(res.lastPage);
      setStatus('idle');
    } catch (err) {
      setError(apiErrorMessage(err, 'Impossible de charger vos colis reçus.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => { if (isAuthenticated) load(1); }, [isAuthenticated, load]);

  return (
    <div>
      <TopBar
        title="Colis reçus"
        subtitle="Les envois qui vous sont destinés"
        back
        right={isAuthenticated && (
          <button
            type="button"
            onClick={() => load(1)}
            className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white text-surface-700 shadow-card"
            aria-label="Rafraîchir"
          >
            <RefreshCw size={18} className={status === 'loading' ? 'animate-spin' : ''} />
          </button>
        )}
      />

      <div className="page-container space-y-4 pb-6 pt-2">
        {!isAuthenticated ? (
          <EmptyState
            icon={Inbox}
            title="Connectez-vous pour voir vos colis reçus"
            description="Avec votre compte, retrouvez les colis envoyés à votre numéro et faites-vous livrer à domicile."
            action={(
              <button type="button" className="btn-primary" onClick={() => dispatch(openAuthSheet({ mode: 'login', reason: 'default' }))}>
                Se connecter
              </button>
            )}
          />
        ) : (
          <>
            <SearchByCode />

            {status === 'loading' && items.length === 0 && <LoadingSpinner label="Chargement de vos colis reçus..." />}
            {status === 'error' && items.length === 0 && (
              <EmptyState
                icon={Inbox}
                title="Chargement impossible"
                description={error}
                action={<button type="button" className="btn-primary" onClick={() => load(1)}>Réessayer</button>}
              />
            )}
            {status === 'idle' && items.length === 0 && (
              <EmptyState
                icon={Inbox}
                title="Aucun colis reçu pour l’instant"
                description="Les colis envoyés à votre numéro de téléphone apparaîtront ici automatiquement."
              />
            )}

            {items.length > 0 && (
              <div className="space-y-2.5">
                {items.map((exp) => <ReceivedCard key={exp.id} exp={exp} />)}
              </div>
            )}
            {page < lastPage && (
              <button type="button" className="btn-secondary w-full" onClick={() => load(page + 1)} disabled={status === 'loading'}>
                {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : null} Charger plus
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
