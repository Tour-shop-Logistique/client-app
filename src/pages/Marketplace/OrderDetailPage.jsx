import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Wallet, Smartphone, Banknote, Copy, Check, Loader2, Hourglass, Truck, PartyPopper, PackageX, RefreshCw, Send, AlertTriangle, Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import OrderTimeline from '../../components/marketplace/OrderTimeline';
import StatusBadge from '../../components/marketplace/StatusBadge';
import GuestGate from '../../components/marketplace/GuestGate';
import { ProofPicker } from '../../components/marketplace/FilePickers';
import {
  OrderItemsCard, PaymentInfoCard, DeliveryInfoCard, DeliveryCodeCard, PersonRow,
} from '../../components/marketplace/OrderParts';
import marketplaceService from '../../services/marketplaceService';
import { useRealtimeMarketplace } from '../../hooks/useRealtimeUpdates';
import {
  COMMANDE_STATUTS, PAYMENT_METHODS, formatMoney, apiErrorMessage, copyText, isCommandeAnnulable,
  needsDeliveryChoice, deliveryMode, isSelfDelivery,
} from '../../utils/marketplace';
import CancelOrderButton from '../../components/marketplace/CancelOrderButton';
import DeliveryModeOptions from '../../components/marketplace/DeliveryModeOptions';
import { MODE_META } from '../../components/marketplace/deliveryModes';
import useDeliveryQuotes from '../../hooks/useDeliveryQuotes';
import useCommunes from '../../hooks/useCommunes';
import { deliveryContextOf } from '../../utils/deliveryContext';
import { formatDistance } from '../../services/routingService';
import { ROUTES } from '../../routes';

const METHOD_ICONS = { mobile_money: Smartphone, cash: Banknote };
const FALLBACK_METHODS = [
  { id: 'fb-mm', methode: 'mobile_money', libelle: 'Mobile money' },
  { id: 'fb-cash', methode: 'cash', libelle: 'Cash à la livraison' },
];

// Declaration de paiement (section 4) : l'acheteur paie hors application puis
// declare ; la commande passe en `paiement_a_confirmer`.
function DeclarePaymentPanel({ commande, onDeclared }) {
  const [moyens, setMoyens] = useState(null);
  const [selected, setSelected] = useState(null);
  const [reference, setReference] = useState('');
  const [preuve, setPreuve] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    marketplaceService
      .vendeurMoyensPaiement(commande.vendeur_id)
      .then((list) => {
        const options = list.length ? list : FALLBACK_METHODS;
        setMoyens(options);
        setSelected(options[0]);
      })
      .catch(() => {
        setMoyens(FALLBACK_METHODS);
        setSelected(FALLBACK_METHODS[0]);
      });
  }, [commande.vendeur_id]);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const updated = await marketplaceService.declarerPaiementCommande(commande.id, {
        paymentMethod: selected.methode,
        reference: reference.trim(),
        preuve,
      });
      toast.success('Paiement déclaré', { description: 'Le vendeur va vérifier et confirmer la réception.' });
      onDeclared(updated);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Impossible de déclarer le paiement.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card space-y-4 p-4">
      <div>
        <h2 className="text-body font-semibold text-surface-900">1. Payez le vendeur</h2>
        <p className="text-caption text-surface-500">
          Envoyez <strong className="text-surface-900">{formatMoney(commande.montant_articles)}</strong> avec l’un des moyens acceptés.
        </p>
      </div>

      {moyens === null ? (
        <div className="space-y-2">
          <div className="h-16 skeleton rounded-2xl" />
          <div className="h-16 skeleton rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-2" role="radiogroup">
          {moyens.map((m) => {
            const Icon = METHOD_ICONS[m.methode] ?? Wallet;
            const active = selected?.id === m.id;
            return (
              <motion.button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={active}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelected(m)}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${
                  active ? 'border-shop-400 bg-shop-50' : 'border-surface-100 bg-white hover:border-surface-200'
                }`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-shop-400 text-shop-950' : 'bg-surface-100 text-surface-600'}`}>
                  <Icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold text-surface-900">{m.libelle || PAYMENT_METHODS[m.methode]}</span>
                  {m.numero_destinataire ? (
                    <span className="block font-mono text-body tracking-wide text-surface-600">{m.numero_destinataire}</span>
                  ) : (
                    <span className="block text-caption text-surface-500">{PAYMENT_METHODS[m.methode]}</span>
                  )}
                </span>
                {m.numero_destinataire && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      copyText(m.numero_destinataire, 'Numéro copié');
                    }}
                    className="rounded-full bg-white p-2 text-surface-500 shadow-card"
                    aria-label="Copier le numéro"
                  >
                    <Copy size={15} />
                  </span>
                )}
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-shop-600 bg-shop-600 text-white' : 'border-surface-300'}`}>
                  {active && <Check size={12} strokeWidth={3} />}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}

      <div className="space-y-3 border-t border-dashed border-surface-200 pt-4">
        <div>
          <h2 className="text-body font-semibold text-surface-900">2. Déclarez votre paiement</h2>
          <p className="text-caption text-surface-500">
            {selected?.methode === 'cash'
              ? 'Pour un paiement cash à la livraison, déclarez-le maintenant : le vendeur confirmera à réception.'
              : 'Indiquez la référence de la transaction et joignez une capture si possible.'}
          </p>
        </div>
        <input
          className="input-field"
          placeholder="Référence de transaction (optionnel)"
          value={reference}
          maxLength={255}
          onChange={(e) => setReference(e.target.value)}
        />
        <ProofPicker file={preuve} onChange={setPreuve} />
        <motion.button type="button" whileTap={{ scale: 0.97 }} className="btn-shop w-full" disabled={!selected || submitting} onClick={submit}>
          {submitting ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
          {submitting ? 'Envoi…' : 'J’ai payé, déclarer le paiement'}
        </motion.button>
      </div>
    </section>
  );
}

// Choix du mode de livraison par L'ACHETEUR, une fois son paiement confirme
// (MARKETPLACE_LIVRAISON_3_MODES.md) : il voit les 3 prix, choisit sa commune
// (liste, jamais du texte libre) et le mode. La distance calculee par l'app est
// renvoyee : c'est elle qui sert a facturer.
function DeliveryChoicePanel({ commande, onDone }) {
  const ctx = useMemo(() => deliveryContextOf(commande), [commande]);
  const { communes, status: communesStatus } = useCommunes();
  const [communeId, setCommuneId] = useState(ctx.communeLivraisonId);
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [vendorRates, setVendorRates] = useState(null);

  // Commune non memorisee : on la retrouve d'apres la ville de livraison.
  useEffect(() => {
    if (communeId || !commande.livraison_ville || communes.length === 0) return;
    const match = communes.find((c) => c.nom.toLowerCase() === String(commande.livraison_ville).trim().toLowerCase());
    if (match) setCommuneId(match.id);
  }, [communeId, communes, commande.livraison_ville]);

  const quotes = useDeliveryQuotes({
    vendeurId: commande.vendeur_id,
    communeDepartId: ctx.communeDepartId,
    communeArriveeId: communeId,
    from: ctx.from,
    to: ctx.to,
  });

  // Apercu impossible (commune de depart inconnue) : standard et express restent
  // proposes sans prix ; le livreur du vendeur seulement s'il dessert la commune.
  const noPreview = quotes.status === 'incomplete' || quotes.status === 'error';
  useEffect(() => {
    if (!noPreview || !commande.vendeur_id) return;
    marketplaceService.tarifsVendeur(commande.vendeur_id).then(setVendorRates).catch(() => setVendorRates([]));
  }, [noPreview, commande.vendeur_id]);
  const unpricedModes = useMemo(() => {
    if (!noPreview || !communeId) return [];
    const vendorServes = (vendorRates ?? []).some((t) => String(t.commune_destination_id) === String(communeId) && t.actif !== false);
    return ['standard', 'express', ...(vendorServes ? ['livreur_magasin'] : [])];
  }, [noPreview, communeId, vendorRates]);

  // Mode choisi devenu indisponible (changement de commune) : on le retire.
  useEffect(() => {
    if (!mode) return;
    const available = quotes.tarifs?.[mode] != null || unpricedModes.includes(mode);
    if (!available && quotes.status !== 'loading') setMode(null);
  }, [mode, quotes.tarifs, quotes.status, unpricedModes]);

  const submit = async () => {
    if (!mode || !communeId) return;
    setBusy(true);
    try {
      const res = await marketplaceService.choisirLivraison(commande.id, mode, {
        communeLivraisonId: communeId,
        distanceKm: quotes.distanceKm,
      });
      toast.success(res?.message || 'Mode de livraison choisi.', {
        description: mode === 'express'
          ? 'Votre livraison est proposée aux livreurs disponibles.'
          : mode === 'standard'
            ? 'TourShop affecte un livreur à votre commande.'
            : 'Le vendeur va désigner son livreur.',
      });
      onDone();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Impossible de choisir ce mode de livraison.'));
    } finally {
      setBusy(false);
    }
  };

  const price = mode ? quotes.tarifs?.[mode] : null;

  return (
    <section className="card space-y-4 p-4">
      <div>
        <h2 className="text-body font-semibold text-surface-900">Choisissez votre livraison</h2>
        <p className="text-caption text-surface-500">Le vendeur a confirmé votre paiement. Comment voulez-vous être livré ?</p>
      </div>

      <label className="block" htmlFor="commune-livraison">
        <span className="text-caption font-medium text-surface-600">Commune de livraison</span>
        <select
          id="commune-livraison"
          className="input-field mt-1"
          value={communeId ?? ''}
          onChange={(e) => setCommuneId(e.target.value || null)}
          disabled={communesStatus === 'loading'}
        >
          <option value="">{communesStatus === 'loading' ? 'Chargement des communes…' : 'Choisir une commune'}</option>
          {communes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </label>

      {communeId && (
        <DeliveryModeOptions
          tarifs={quotes.tarifs}
          status={quotes.status}
          value={mode}
          onSelect={setMode}
          unpricedModes={unpricedModes}
        />
      )}
      {quotes.distanceKm != null && (
        <p className="text-caption text-surface-500">Distance estimée : {formatDistance(quotes.distanceKm)} depuis le lieu de retrait.</p>
      )}

      <motion.button type="button" whileTap={{ scale: 0.97 }} className="btn-shop w-full" disabled={!mode || !communeId || busy} onClick={submit}>
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Truck size={16} />}
        {mode ? `Choisir ${MODE_META[mode].title.toLowerCase()}${price != null ? ` · ${formatMoney(price)}` : ''}` : 'Choisir un mode de livraison'}
      </motion.button>
      <p className="text-caption text-surface-500">
        Les frais de livraison se règlent hors application, comme vos articles. Le mode choisi ne pourra plus être changé.
      </p>
    </section>
  );
}

const HEADLINES = {
  en_attente_paiement: { icon: Wallet, title: 'Paiement attendu', text: 'Payez le vendeur puis déclarez votre paiement.', cls: 'bg-amber-50 text-amber-900' },
  paiement_a_confirmer: { icon: Hourglass, title: 'Vérification en cours', text: 'Le vendeur vérifie la réception de votre paiement.', cls: 'bg-primary-50 text-primary-900' },
  payee: { icon: Truck, title: 'Paiement confirmé', text: 'Le vendeur organise la livraison de votre commande.', cls: 'bg-emerald-50 text-emerald-900' },
  livree: { icon: PartyPopper, title: 'Commande livrée', text: 'Merci pour votre achat !', cls: 'bg-emerald-50 text-emerald-900' },
  annulee: { icon: Ban, title: 'Commande annulée', text: 'Cette commande a été annulée.', cls: 'bg-surface-100 text-surface-700' },
};

const showError = (err, fallback) => toast.error(apiErrorMessage(err, fallback));

export default function OrderDetailPage() {
  const { id } = useParams();
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const [commande, setCommande] = useState(undefined);
  const [infirme, setInfirme] = useState(false);

  const load = useCallback(() => {
    marketplaceService
      .commandeShow(id)
      .then(setCommande)
      .catch(() => setCommande(null));
  }, [id]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  // Temps reel : paiement confirme / infirme, livreur assigne, course demarree, livree.
  useRealtimeMarketplace(id, useCallback((data, meta) => {
    if (meta.model === 'CommandeMarketplace' && meta.action === 'paiement_infirme') setInfirme(true);
    if (meta.model === 'CommandeMarketplace' && meta.action === 'paiement_declare') setInfirme(false);
    load();
  }, [load]), isAuthenticated);

  if (!isAuthenticated) {
    return (
      <div>
        <TopBar title="Commande" back />
        <div className="page-container py-4">
          <GuestGate />
        </div>
      </div>
    );
  }

  const liv = commande?.livraison_marketplace;
  const headline = HEADLINES[commande?.statut];
  const chooseDelivery = needsDeliveryChoice(commande);
  const mode = deliveryMode(commande);
  const onTheWay = commande?.statut === 'payee' && liv?.statut === 'en_cours';
  // Message d'attente selon le mode choisi, tant qu'aucun livreur n'a la course.
  const waitingText = (() => {
    if (commande?.statut !== 'payee' || chooseDelivery) return null;
    if (isSelfDelivery(commande)) return 'Le vendeur vous livre lui-même : il vous contactera.';
    if (mode === 'livreur_magasin' && (!liv?.livreur_id || ['en_attente', 'refusee', 'expiree', 'proposee'].includes(liv?.statut))) {
      return 'Le vendeur désigne son livreur pour votre commande.';
    }
    if (liv?.statut === 'en_attente') {
      return mode === 'express'
        ? 'Votre livraison express est proposée aux livreurs disponibles.'
        : 'TourShop affecte un livreur à votre commande.';
    }
    return null;
  })();
  // Paiement deja declare puis infirme par le vendeur : re-declarer.
  const paymentRejected = commande?.statut === 'en_attente_paiement' && (infirme || Boolean(commande.paiement_declare_le));

  return (
    <div>
      <TopBar
        title="Détail de la commande"
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
            <div className="h-24 skeleton rounded-2xl shadow-card" />
            <div className="h-40 skeleton rounded-2xl shadow-card" />
          </div>
        )}

        {commande === null && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <PackageX size={36} className="text-surface-400" />
            <p className="text-title text-surface-900">Commande introuvable</p>
            <Link to={ROUTES.MARKETPLACE_ORDERS} className="btn-secondary">
              Mes achats
            </Link>
          </div>
        )}

        {commande && (
          <AnimatePresence mode="wait">
            <motion.div key={commande.statut} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {headline && (
                <div className={`flex items-center gap-3 rounded-2xl p-4 ${headline.cls}`}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70">
                    <headline.icon size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{headline.title}</p>
                    <p className="text-caption opacity-80">
                      {onTheWay
                        ? 'Le livreur a récupéré votre article : il est en route. Préparez votre code.'
                        : chooseDelivery ? 'Choisissez maintenant votre mode de livraison.'
                          : waitingText
                            || (commande.statut === 'annulee' && commande.motif_annulation ? `Motif : « ${commande.motif_annulation} »` : headline.text)}
                    </p>
                  </div>
                </div>
              )}

              <div className="card p-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-caption text-surface-400">N° {String(commande.id).slice(0, 8).toUpperCase()}</span>
                  <StatusBadge map={COMMANDE_STATUTS} value={commande.statut} />
                </div>
                <OrderTimeline commande={commande} />
              </div>

              {!['livree', 'annulee'].includes(commande.statut) && <DeliveryCodeCard code={commande.code_validation_livraison} />}

              {paymentRejected && (
                <div className="flex gap-3 rounded-2xl bg-red-50 p-4 text-red-900">
                  <AlertTriangle size={20} className="shrink-0" />
                  <div>
                    <p className="text-body font-semibold">Le vendeur n’a pas reçu votre paiement</p>
                    <p className="text-caption">Vérifiez votre transaction puis re-déclarez un paiement ci-dessous (vous pouvez changer de moyen).</p>
                  </div>
                </div>
              )}

              {commande.statut === 'en_attente_paiement' && (
                <DeclarePaymentPanel
                  commande={commande}
                  onDeclared={() => {
                    setInfirme(false);
                    load();
                  }}
                />
              )}

              {chooseDelivery && <DeliveryChoicePanel commande={commande} onDone={load} />}

              <DeliveryInfoCard commande={commande} />
              <OrderItemsCard commande={commande} />
              {commande.statut !== 'en_attente_paiement' && <PaymentInfoCard commande={commande} title="Votre paiement" />}

              <div className="card p-4">
                <PersonRow label="Vendeur" person={commande.vendeur} />
              </div>

              {commande.statut === 'en_attente_paiement' && (
                <p className="px-1 text-caption text-surface-500">
                  Sans déclaration de paiement sous 48 h, la commande est annulée automatiquement.
                </p>
              )}
              {isCommandeAnnulable(commande) && (
                <CancelOrderButton commandeId={commande.id} role="acheteur" onDone={load} handleError={showError} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
