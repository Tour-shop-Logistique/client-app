import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2, XCircle, Loader2, UserCheck, Home, Truck, RefreshCw, PackageCheck, PackageX, Info,
  Timer, UserX, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import BottomSheet from '../../components/common/BottomSheet';
import OrderTimeline from '../../components/marketplace/OrderTimeline';
import StatusBadge from '../../components/marketplace/StatusBadge';
import { OrderItemsCard, PaymentInfoCard, DeliveryInfoCard, PersonRow } from '../../components/marketplace/OrderParts';
import useMarketplaceError from '../../hooks/useMarketplaceError';
import { useRealtimeMarketplace } from '../../hooks/useRealtimeUpdates';
import marketplaceService from '../../services/marketplaceService';
import {
  COMMANDE_STATUTS, formatMoney, isLivraisonActive, isCommandeAnnulable,
  needsDeliveryChoice, needsMagasinAssignment, isAwaitingCourier, isSelfDelivery,
} from '../../utils/marketplace';
import CancelOrderButton from '../../components/marketplace/CancelOrderButton';
import { ROUTES } from '../../routes';

// Secondes restantes avant `expire_le` (null si inconnu).
function useSecondsLeft(expireLe) {
  const compute = useCallback(() => {
    const t = Date.parse(expireLe ?? '');
    return Number.isFinite(t) ? Math.max(0, Math.floor((t - Date.now()) / 1000)) : null;
  }, [expireLe]);
  const [left, setLeft] = useState(compute);
  useEffect(() => {
    setLeft(compute());
    if (!expireLe) return undefined;
    const t = setInterval(() => setLeft(compute()), 1000);
    return () => clearInterval(t);
  }, [compute, expireLe]);
  return left;
}

// Affectation directe : le livreur a 15 min pour accepter (section 6, livraison/direct).
function DirectProposalPanel({ livraison, onExpired }) {
  const left = useSecondsLeft(livraison.expire_le);
  useEffect(() => {
    if (left === 0) onExpired?.();
  }, [left, onExpired]);
  return (
    <section className="card flex items-center gap-3 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
        <Timer size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-surface-900">En attente de l’accord du livreur</p>
        <p className="text-caption text-surface-500">
          {left === 0
            ? 'Délai écoulé : vérification en cours…'
            : 'Sans réponse sous 15 minutes, vous pourrez désigner un autre livreur.'}
        </p>
      </div>
      {left != null && left > 0 && (
        <span className="rounded-full bg-amber-50 px-2.5 py-1 font-mono text-caption font-bold text-amber-800">
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </span>
      )}
    </section>
  );
}

// Confirmation du paiement par le vendeur (section 5).
function PaymentConfirmPanel({ commande, onDone, handleError }) {
  const [busy, setBusy] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(null);

  const run = async (action) => {
    setBusy(action);
    try {
      if (action === 'confirm') await marketplaceService.confirmerPaiement(commande.id);
      else await marketplaceService.infirmerPaiement(commande.id);
      toast.success(action === 'confirm' ? 'Paiement confirmé, commande payée' : 'Paiement infirmé, l’acheteur peut re-déclarer');
      setConfirmOpen(null);
      onDone();
    } catch (err) {
      handleError(err, 'Action impossible.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PaymentInfoCard commande={commande} title="Paiement déclaré par l’acheteur" />
      <div className="rounded-2xl bg-amber-50 p-3.5 text-caption text-amber-900">
        Vérifiez que vous avez bien reçu <strong>{formatMoney(commande.montant_articles)}</strong> (sur votre compte mobile money ou en cash)
        avant de confirmer. L’application ne vérifie rien automatiquement.
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary text-red-600" onClick={() => setConfirmOpen('reject')}>
          <XCircle size={16} /> Pas reçu
        </button>
        <button type="button" className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setConfirmOpen('confirm')}>
          <CheckCircle2 size={16} /> J’ai reçu
        </button>
      </div>

      <BottomSheet
        open={Boolean(confirmOpen)}
        onClose={() => setConfirmOpen(null)}
        title={confirmOpen === 'confirm' ? 'Confirmer la réception ?' : 'Infirmer le paiement ?'}
      >
        <p className="text-body text-surface-600">
          {confirmOpen === 'confirm'
            ? 'La commande passera en « payée » et l’article sera marqué vendu. L’acheteur choisira ensuite son mode de livraison.'
            : 'La commande reviendra en attente de paiement et l’acheteur pourra déclarer un nouveau paiement.'}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary" onClick={() => setConfirmOpen(null)}>
            Annuler
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => run(confirmOpen)}
            className={`btn text-white ${confirmOpen === 'confirm' ? 'bg-emerald-600' : 'bg-red-600'}`}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {confirmOpen === 'confirm' ? 'Confirmer' : 'Infirmer'}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

// Mode « livreur du vendeur » choisi par l'acheteur : le vendeur designe son
// livreur (POST ventes/{id}/livraison/magasin/assigner, MARKETPLACE_LIVRAISON_3_MODES.md).
//  - un livreur TourShop retrouve par son numero -> `proposee`, 15 min pour accepter ;
//  - lui-meme / un livreur hors application -> `assignee`, puis « Marquer comme livrée ».
const ASSIGN_OPTIONS = [
  { key: 'plateforme', icon: UserCheck, title: 'Un livreur TourShop', text: 'Retrouvé par son numéro, il a 15 min pour accepter. L’acheteur reçoit un code de remise.' },
  { key: 'hors', icon: Home, title: 'Je livre moi-même', text: 'Vous ou votre livreur hors application. Vous confirmerez la livraison vous-même.' },
];

function AssignCourierPanel({ commande, onDone, handleError }) {
  const liv = commande.livraison_marketplace;
  const [option, setOption] = useState('plateforme');
  const [busy, setBusy] = useState(false);
  const [telephone, setTelephone] = useState('');
  const [livreur, setLivreur] = useState(null);
  const [search, setSearch] = useState({ status: 'idle', error: null });

  const findLivreur = async () => {
    const tel = telephone.trim();
    if (tel.length < 6) {
      setSearch({ status: 'error', error: 'Saisissez le numéro de téléphone complet du livreur.' });
      return;
    }
    setSearch({ status: 'loading', error: null });
    setLivreur(null);
    try {
      setLivreur(await marketplaceService.rechercherLivreur(tel));
      setSearch({ status: 'idle', error: null });
    } catch (err) {
      if (err.response?.status === 404) {
        setSearch({ status: 'error', error: 'Aucun livreur TourShop validé avec ce numéro dans votre pays.' });
      } else {
        setSearch({ status: 'idle', error: null });
        handleError(err, 'Recherche impossible pour le moment.');
      }
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await marketplaceService.assignerLivreurMagasin(commande.id, option === 'plateforme' ? livreur.id : null);
      toast.success(option === 'plateforme' ? 'Livreur désigné' : 'Livraison par vos soins', {
        description: option === 'plateforme'
          ? 'Il a 15 minutes pour accepter la course.'
          : 'Livrez l’acheteur puis marquez la commande comme livrée.',
      });
      onDone();
    } catch (err) {
      handleError(err, 'Impossible de désigner ce livreur.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-3 p-4">
      <div>
        <h2 className="text-body font-semibold text-surface-900">Désignez votre livreur</h2>
        <p className="text-caption text-surface-500">
          L’acheteur a choisi d’être livré par votre livreur
          {liv?.montant_final != null ? <> pour <strong className="text-surface-900">{formatMoney(liv.montant_final)}</strong> (votre tarif)</> : ''}.
        </p>
      </div>

      <div className="space-y-2" role="radiogroup">
        {ASSIGN_OPTIONS.map((m) => {
          const active = option === m.key;
          return (
            <motion.button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={active}
              whileTap={{ scale: 0.98 }}
              onClick={() => setOption(m.key)}
              className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition ${
                active ? 'border-shop-400 bg-shop-50' : 'border-surface-100 hover:border-surface-200'
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-shop-400 text-shop-950' : 'bg-surface-100 text-surface-600'}`}>
                <m.icon size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold text-surface-900">{m.title}</span>
                <span className="block text-caption text-surface-500">{m.text}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {option === 'plateforme' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-1">
              <label htmlFor="livreur-telephone" className="block text-caption font-medium text-surface-600">
                Téléphone du livreur
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="livreur-telephone"
                  className="input-field flex-1"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="Ex : 0705060708"
                  value={telephone}
                  onChange={(e) => {
                    setTelephone(e.target.value);
                    setLivreur(null);
                    setSearch({ status: 'idle', error: null });
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); findLivreur(); } }}
                />
                <button type="button" className="btn-secondary shrink-0" onClick={findLivreur} disabled={search.status === 'loading'}>
                  {search.status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : 'Rechercher'}
                </button>
              </div>
              {search.error && <p className="mt-1 text-[11px] text-red-600">{search.error}</p>}
              {!livreur && !search.error && (
                <p className="mt-1 text-[11px] text-surface-400">Le numéro exact avec lequel le livreur est inscrit sur TourShop.</p>
              )}
              {livreur && (
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700">
                    <Truck size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-surface-900">
                      {[livreur.prenoms, livreur.nom].filter(Boolean).join(' ') || 'Livreur TourShop'}
                    </p>
                    <p className="truncate text-[11px] capitalize text-surface-500">
                      {[livreur.type_vehicule, livreur.ville].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${livreur.disponible ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {livreur.disponible ? 'Disponible' : 'Hors ligne'}
                  </span>
                </div>
              )}
              {livreur && !livreur.disponible && (
                <p className="mt-1 text-[11px] text-amber-700">Ce livreur est hors ligne : il ne pourra accepter qu’en repassant disponible.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="flex gap-2 rounded-xl bg-surface-50 p-3 text-caption text-surface-600">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          L’adresse de retrait de l’annonce est transmise au livreur.{' '}
          <Link to={ROUTES.MARKETPLACE_MY_LISTINGS} className="font-semibold text-primary-700">Vérifier mes annonces</Link>
        </span>
      </p>

      <button type="button" className="btn-shop w-full" disabled={busy || (option === 'plateforme' && !livreur?.id)} onClick={submit}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
        {option === 'plateforme' ? 'Proposer la course à ce livreur' : 'Je m’occupe de la livraison'}
      </button>
    </section>
  );
}

// Standard / express : rien a faire pour le vendeur, un livreur viendra.
function CourierPendingPanel({ mode }) {
  return (
    <section className="card flex items-center gap-3 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
        {mode === 'express' ? <Zap size={20} /> : <Truck size={20} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-surface-900">
          {mode === 'express' ? 'Livraison express en recherche de livreur' : 'Livraison standard en attente de livreur'}
        </p>
        <p className="text-caption text-surface-500">
          {mode === 'express'
            ? 'La course est proposée aux livreurs disponibles : le premier qui accepte viendra récupérer l’article.'
            : 'TourShop affecte un livreur, qui viendra récupérer l’article à votre adresse de retrait.'}
        </p>
      </div>
    </section>
  );
}

function MarkDeliveredPanel({ commande, onDone, handleError }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!window.confirm('Confirmez-vous que l’acheteur a bien reçu sa commande ?')) return;
    setBusy(true);
    try {
      await marketplaceService.marquerLivree(commande.id);
      toast.success('Commande marquée comme livrée 🎉');
      onDone();
    } catch (err) {
      handleError(err, 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={run} disabled={busy} className="btn w-full bg-emerald-600 text-white hover:bg-emerald-700">
      {busy ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />} Marquer comme livrée
    </button>
  );
}

export default function SaleDetailPage() {
  const { id } = useParams();
  const handleError = useMarketplaceError();
  const [commande, setCommande] = useState(undefined);

  // commandes/show (accessible au vendeur) inclut acheteur, preuves et livraison.
  const load = useCallback(() => {
    marketplaceService
      .commandeShow(id)
      .then(setCommande)
      .catch(() => setCommande(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Temps reel : paiement declare, mode choisi par l'acheteur, livreur qui
  // accepte / refuse, course demarree…
  useRealtimeMarketplace(id, useCallback(() => {
    load();
  }, [load]));

  const liv = commande?.livraison_marketplace;
  const payee = commande?.statut === 'payee';
  // Workflow 3 modes : l'acheteur choisit ; le vendeur n'agit qu'en mode
  // livreur_magasin (designer son livreur, ou livrer lui-meme).
  const buyerChoosing = needsDeliveryChoice(commande);
  const mustAssign = needsMagasinAssignment(commande);
  const courierDeclined = mustAssign && ['refusee', 'expiree'].includes(liv?.statut);
  const waitingCourier = payee && liv?.statut === 'proposee';
  const courierPending = isAwaitingCourier(commande);
  const selfDelivery = isSelfDelivery(commande);
  const courierAssigned = payee && !selfDelivery && isLivraisonActive(liv) && !['en_attente', 'proposee'].includes(liv.statut);

  return (
    <div>
      <TopBar
        title="Détail de la vente"
        back
        right={
          commande && (
            <button type="button" onClick={load} className="rounded-full p-2 text-surface-500 hover:bg-surface-100" aria-label="Actualiser">
              <RefreshCw size={18} />
            </button>
          )
        }
      />
      <div className="page-container space-y-4 py-4">
        {commande === undefined && (
          <div className="space-y-3">
            <div className="h-28 skeleton rounded-2xl shadow-card" />
            <div className="h-48 skeleton rounded-2xl shadow-card" />
          </div>
        )}

        {commande === null && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <PackageX size={36} className="text-surface-400" />
            <p className="text-title">Vente introuvable</p>
            <Link to={ROUTES.MARKETPLACE_SALES} className="btn-secondary">
              Mes ventes
            </Link>
          </div>
        )}

        {commande && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="card p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-caption text-surface-400">N° {String(commande.id).slice(0, 8).toUpperCase()}</span>
                <StatusBadge map={COMMANDE_STATUTS} value={commande.statut} />
              </div>
              <OrderTimeline commande={commande} />
            </div>

            {commande.statut === 'en_attente_paiement' && (
              <div className="flex gap-2.5 rounded-2xl bg-surface-100 p-3.5 text-caption text-surface-600">
                <Info size={16} className="mt-0.5 shrink-0" />
                L’acheteur n’a pas encore déclaré son paiement. Vous serez averti dès qu’il le fera.
              </div>
            )}

            {commande.statut === 'paiement_a_confirmer' && (
              <PaymentConfirmPanel commande={commande} onDone={load} handleError={handleError} />
            )}

            {courierDeclined && (
              <div className="flex gap-2.5 rounded-2xl bg-red-50 p-3.5 text-caption text-red-800">
                <UserX size={16} className="mt-0.5 shrink-0" />
                <span>
                  {liv.statut === 'expiree' ? 'Le livreur n’a pas répondu dans les 15 minutes.' : 'Le livreur a refusé la livraison.'}
                  {liv.motif_refus && liv.motif_refus !== 'Expiré' ? ` Motif : « ${liv.motif_refus} ».` : ''} Désignez un autre livreur.
                </span>
              </div>
            )}
            {buyerChoosing && (
              <div className="flex gap-2.5 rounded-2xl bg-primary-50 p-3.5 text-caption text-primary-900">
                <Truck size={16} className="mt-0.5 shrink-0" />
                <span>
                  Paiement confirmé. L’acheteur choisit maintenant son mode de livraison (standard, express ou votre livreur).
                  {' '}
                  <Link to={ROUTES.MARKETPLACE_DELIVERY_RATES} className="font-semibold text-primary-700">Mes tarifs de livraison</Link>
                </span>
              </div>
            )}
            {mustAssign && <AssignCourierPanel commande={commande} onDone={load} handleError={handleError} />}
            {waitingCourier && <DirectProposalPanel livraison={liv} onExpired={load} />}
            {courierPending && <CourierPendingPanel mode={liv.mode} />}
            {selfDelivery && <MarkDeliveredPanel commande={commande} onDone={load} handleError={handleError} />}
            {courierAssigned && (
              <div className="flex gap-2.5 rounded-2xl bg-primary-50 p-3.5 text-caption text-primary-900">
                <Truck size={16} className="mt-0.5 shrink-0" />
                {liv.statut === 'en_cours'
                  ? 'Le livreur a récupéré l’article et le livre à l’acheteur.'
                  : 'Le livreur récupère l’article à votre adresse de retrait, puis valide la remise avec le code de l’acheteur.'}
              </div>
            )}

            {commande.statut === 'livree' && commande.montant_commission_vendeur != null && (
              <section className="card space-y-2 p-4">
                <h2 className="text-body font-semibold text-surface-900">Récapitulatif</h2>
                <div className="flex justify-between text-body text-surface-600">
                  <span>Vente</span>
                  <span>{formatMoney(commande.montant_articles)}</span>
                </div>
                <div className="flex justify-between text-body text-surface-600">
                  <span>Commission</span>
                  <span>− {formatMoney(commande.montant_commission_vendeur)}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-surface-200 pt-2 font-semibold text-surface-900">
                  <span>Crédité (indicatif)</span>
                  <span>{formatMoney(Number(commande.montant_articles) - Number(commande.montant_commission_vendeur))}</span>
                </div>
              </section>
            )}

            <DeliveryInfoCard commande={commande} showPickup />
            <OrderItemsCard commande={commande} />
            {commande.statut !== 'paiement_a_confirmer' && <PaymentInfoCard commande={commande} title="Paiement" />}
            <div className="card p-4">
              <PersonRow label="Acheteur" person={commande.acheteur} />
            </div>
            {commande.statut === 'annulee' && (
              <div className="flex gap-2.5 rounded-2xl bg-surface-100 p-3.5 text-caption text-surface-600">
                <Info size={16} className="mt-0.5 shrink-0" />
                <span>Commande annulée{commande.motif_annulation ? ` : « ${commande.motif_annulation} »` : ''}.</span>
              </div>
            )}
            {isCommandeAnnulable(commande) && (
              <CancelOrderButton commandeId={commande.id} role="vendeur" onDone={load} handleError={handleError} />
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
