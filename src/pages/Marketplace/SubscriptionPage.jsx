import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck, Lock, Hourglass, AlertTriangle, CalendarClock, Send, Loader2, RefreshCw, XCircle, Sparkles, Smartphone, Banknote, Landmark,
} from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import StatusBadge from '../../components/marketplace/StatusBadge';
import GuestGate from '../../components/marketplace/GuestGate';
import { ProofPicker } from '../../components/marketplace/FilePickers';
import abonnementService from '../../services/abonnementService';
import { fetchAbonnementStatut } from '../../store/slices/marketplaceSlice';
import {
  ECHEANCE_STATUTS, PAIEMENT_ABONNEMENT_STATUTS, PAYMENT_METHODS, formatMoney, apiErrorMessage,
} from '../../utils/marketplace';
import { formatDate } from '../../utils/format';
import { ROUTES } from '../../routes';

const METHODS = [
  { key: 'mobile_money', icon: Smartphone },
  { key: 'bank_transfer', icon: Landmark },
  { key: 'cash', icon: Banknote },
];

const DAY = 24 * 60 * 60 * 1000;

function PeriodProgress({ echeance }) {
  const start = new Date(echeance.periode_debut).getTime();
  const end = new Date(echeance.periode_fin).getTime();
  const now = Date.now();
  const ratio = Math.min(1, Math.max(0, (now - start) / (end - start || 1)));
  const daysLeft = Math.ceil((end - now) / DAY);
  const late = daysLeft < 0;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-heading text-3xl font-bold">
          {late ? Math.abs(daysLeft) : Math.max(0, daysLeft)}
          <span className="ml-1 text-body font-medium opacity-80">{late ? `jour${Math.abs(daysLeft) > 1 ? 's' : ''} de retard` : `jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`}</span>
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full rounded-full ${late ? 'bg-red-300' : ratio > 0.85 ? 'bg-amber-300' : 'bg-shop-300'}`}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-caption opacity-75">
        <span>{formatDate(echeance.periode_debut)}</span>
        <span>{formatDate(echeance.periode_fin)}</span>
      </div>
    </div>
  );
}

// Declaration du paiement d'abonnement (9.8). Ne debloque pas : le backoffice valide.
function DeclareForm({ echeance, onDeclared }) {
  const [methode, setMethode] = useState('mobile_money');
  const [reference, setReference] = useState('');
  const [preuve, setPreuve] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await abonnementService.declarerPaiement(echeance.id, { methode, referenceTransaction: reference.trim(), preuve });
      toast.success('Paiement déclaré', { description: 'En attente de validation par TourShop.' });
      onDeclared();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Impossible de déclarer le paiement.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card space-y-4 p-4">
      <div>
        <h2 className="text-body font-semibold text-surface-900">Déclarer mon paiement</h2>
        <p className="text-caption text-surface-500">
          Payez <strong className="text-surface-900">{formatMoney(echeance.montant)}</strong> sur le compte communiqué par TourShop, puis déclarez-le ici.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => {
          const active = methode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMethode(m.key)}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-2.5 text-[11px] font-semibold transition ${
                active ? 'border-shop-400 bg-shop-50 text-shop-900' : 'border-surface-100 text-surface-600'
              }`}
            >
              <m.icon size={18} /> {PAYMENT_METHODS[m.key]}
            </button>
          );
        })}
      </div>
      <input className="input-field" placeholder="Référence de transaction" maxLength={255} value={reference} onChange={(e) => setReference(e.target.value)} />
      <ProofPicker file={preuve} onChange={setPreuve} />
      <button type="button" className="btn-shop w-full" disabled={submitting} onClick={submit}>
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Envoyer la déclaration
      </button>
    </section>
  );
}

export default function SubscriptionPage() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const { loaded, abonnement, echeanceCourante, bloque } = useSelector((s) => s.marketplace.abonnement);
  const [historique, setHistorique] = useState({ items: null, page: 0, lastPage: 1 });
  const [loadingMore, setLoadingMore] = useState(false);

  const loadHistorique = useCallback(async (page = 1) => {
    const data = await abonnementService.historique({ page, per_page: 20 });
    setHistorique((h) => ({
      items: page === 1 ? data?.data ?? [] : [...(h.items ?? []), ...(data?.data ?? [])],
      page: data?.current_page ?? page,
      lastPage: data?.last_page ?? 1,
    }));
  }, []);

  const refresh = useCallback(() => {
    dispatch(fetchAbonnementStatut());
    loadHistorique(1).catch(() => setHistorique({ items: [], page: 1, lastPage: 1 }));
  }, [dispatch, loadHistorique]);

  useEffect(() => {
    if (isAuthenticated) refresh();
  }, [isAuthenticated, refresh]);

  // Au retour dans l'app : detecter une validation backoffice (9.8).
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && isAuthenticated && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isAuthenticated, refresh]);

  if (!isAuthenticated) {
    return (
      <div>
        <TopBar title="Abonnement" back />
        <div className="page-container py-4">
          <GuestGate />
        </div>
      </div>
    );
  }

  // Le statut ne porte pas le paiement : on le retrouve dans l'historique.
  const currentPaiement = historique.items?.find((e) => e.id === echeanceCourante?.id)?.paiement ?? null;
  const pending = currentPaiement?.statut === 'en_attente';
  const rejected = currentPaiement?.statut === 'rejete';
  const late = echeanceCourante?.statut === 'en_retard';

  const hero = bloque
    ? { icon: Lock, title: 'Accès vendeur suspendu', text: 'Votre échéance est dépassée. Régularisez pour retrouver votre espace vendeur.', cls: 'bg-gradient-to-br from-red-700 to-red-500 text-white' }
    : late
      ? { icon: AlertTriangle, title: 'Échéance dépassée', text: 'Réglez rapidement pour éviter la suspension.', cls: 'bg-gradient-to-br from-red-600 to-orange-500 text-white' }
      : echeanceCourante?.statut === 'rappel_envoye'
        ? { icon: CalendarClock, title: 'Échéance proche', text: 'Pensez à régler votre abonnement.', cls: 'bg-gradient-to-br from-amber-500 to-orange-400 text-white' }
        : { icon: BadgeCheck, title: 'Abonnement actif', text: 'Vous pouvez vendre librement.', cls: 'brand-gradient' };

  return (
    <div>
      <TopBar
        title="Abonnement marketplace"
        back
        right={
          <button type="button" onClick={refresh} className="rounded-full p-2 text-surface-500 hover:bg-surface-100" aria-label="Actualiser">
            <RefreshCw size={18} />
          </button>
        }
      />
      <div className="page-container space-y-4 py-4">
        {!loaded && <div className="h-44 animate-pulse rounded-3xl bg-white shadow-card" />}

        {loaded && !abonnement && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="shop-gradient relative overflow-hidden rounded-3xl p-5">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/25" />
              <Sparkles size={28} />
              <p className="mt-3 font-heading text-xl font-bold">Aucun abonnement en cours</p>
              <p className="mt-1 text-body text-shop-900">
                Vous ne payez rien tant que vous ne vendez pas. L’abonnement démarre automatiquement à la publication de votre première annonce.
              </p>
            </div>
            <Link to={ROUTES.MARKETPLACE_SELL} className="btn-shop w-full">
              Publier une annonce
            </Link>
          </motion.div>
        )}

        {loaded && abonnement && (
          <>
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className={`relative overflow-hidden rounded-3xl p-5 ${hero.cls}`}>
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <hero.icon size={22} />
                </span>
                <div>
                  <p className="font-heading text-lg font-bold">{hero.title}</p>
                  <p className="text-caption opacity-85">{hero.text}</p>
                </div>
              </div>
              {echeanceCourante && (
                <div className="mt-5">
                  <PeriodProgress echeance={echeanceCourante} />
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3 text-caption">
                <div>
                  <p className="opacity-70">Montant</p>
                  <p className="text-body font-semibold">{formatMoney(abonnement.montant)} / {abonnement.periodicite_jours} j</p>
                </div>
                <div>
                  <p className="opacity-70">Profil</p>
                  <p className="text-body font-semibold capitalize">{abonnement.type_abonne}</p>
                </div>
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              {echeanceCourante && pending && (
                <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-3 rounded-2xl bg-primary-50 p-4 text-primary-900">
                  <Hourglass size={20} className="shrink-0" />
                  <div>
                    <p className="text-body font-semibold">Paiement en cours de validation</p>
                    <p className="text-caption">
                      TourShop vérifie votre preuve. {bloque ? 'Votre accès vendeur sera rétabli après validation.' : ''} Revenez plus tard ou actualisez.
                    </p>
                  </div>
                </motion.div>
              )}
              {echeanceCourante && rejected && (
                <motion.div key="rejected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-3 rounded-2xl bg-red-50 p-4 text-red-900">
                  <XCircle size={20} className="shrink-0" />
                  <div>
                    <p className="text-body font-semibold">Paiement rejeté</p>
                    <p className="text-caption">{currentPaiement.commentaire_backoffice || 'Votre déclaration n’a pas pu être validée.'} Vous pouvez déclarer à nouveau.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {echeanceCourante && !pending && <DeclareForm echeance={echeanceCourante} onDeclared={refresh} />}
          </>
        )}

        {historique.items?.length > 0 && (
          <section>
            <h2 className="mb-2 text-body font-semibold text-surface-900">Historique des échéances</h2>
            <ul className="space-y-2">
              {historique.items.map((e, i) => (
                <motion.li
                  key={e.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 10) * 0.03 }}
                  className="rounded-2xl bg-white p-3.5 shadow-card"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-body font-semibold text-surface-900">
                        {formatDate(e.periode_debut)} → {formatDate(e.periode_fin)}
                      </p>
                      <p className="text-caption text-surface-500">{formatMoney(e.montant)}</p>
                    </div>
                    <StatusBadge map={ECHEANCE_STATUTS} value={e.statut} />
                  </div>
                  {e.paiement && (
                    <div className="mt-2 flex items-center justify-between border-t border-surface-100 pt-2 text-caption text-surface-500">
                      <span>
                        {PAYMENT_METHODS[e.paiement.methode] ?? e.paiement.methode}
                        {e.paiement.reference_transaction ? ` · ${e.paiement.reference_transaction}` : ''}
                      </span>
                      <StatusBadge map={PAIEMENT_ABONNEMENT_STATUTS} value={e.paiement.statut} />
                    </div>
                  )}
                </motion.li>
              ))}
            </ul>
            {historique.page < historique.lastPage && (
              <button
                type="button"
                className="btn-secondary mt-3 w-full"
                disabled={loadingMore}
                onClick={async () => {
                  setLoadingMore(true);
                  try {
                    await loadHistorique(historique.page + 1);
                  } finally {
                    setLoadingMore(false);
                  }
                }}
              >
                {loadingMore && <Loader2 size={15} className="animate-spin" />} Voir plus
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
