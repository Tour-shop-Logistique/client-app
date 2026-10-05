import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Tag, Receipt, Wallet, CreditCard, BadgeCheck, Plus, ChevronRight, Info, Truck, Hourglass, Store, Lock,
} from 'lucide-react';
import AbonnementBanner from '../../components/marketplace/AbonnementBanner';
import { ShopBagArt, EmptyTagArt } from '../../components/illustrations';
import AnimatedNumber from '../../components/marketplace/AnimatedNumber';
import GuestGate from '../../components/marketplace/GuestGate';
import marketplaceService from '../../services/marketplaceService';
import { fetchAbonnementStatut } from '../../store/slices/marketplaceSlice';
import { formatMoney, isAbonnementBloque, personName, ECHEANCE_STATUTS, TONE_CLASSES } from '../../utils/marketplace';
import { ROUTES } from '../../routes';

const needsShipping = (c) => c.statut === 'payee' && !c.mode_livraison && !c.livraison_marketplace;

export default function SellerHubPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const user = useSelector((s) => s.auth.user);
  const abonnement = useSelector((s) => s.marketplace.abonnement);

  const [solde, setSolde] = useState(null);
  const [data, setData] = useState({ loading: true, annonces: [], ventes: [], moyens: [], blocked: false });

  useEffect(() => {
    if (!isAuthenticated) return;
    dispatch(fetchAbonnementStatut());
    // Le solde est hors middleware d'abonnement : toujours consultable.
    marketplaceService.solde().then(setSolde).catch(() => setSolde(0));
    Promise.all([marketplaceService.mesAnnonces(), marketplaceService.mesVentes(), marketplaceService.mesMoyensPaiement()])
      .then(([annonces, ventes, moyens]) => setData({ loading: false, annonces, ventes, moyens, blocked: false }))
      .catch((err) => setData({ loading: false, annonces: [], ventes: [], moyens: [], blocked: isAbonnementBloque(err) }));
  }, [isAuthenticated, dispatch]);

  if (!isAuthenticated) {
    return (
      <div className="page-container py-6">
        <GuestGate title="Votre boutique TourShop" description="Connectez-vous pour publier des annonces et suivre vos ventes." />
      </div>
    );
  }

  const { annonces, ventes, moyens, loading, blocked } = data;
  const online = annonces.filter((a) => a.statut === 'publiee').length;
  const toConfirm = ventes.filter((v) => v.statut === 'paiement_a_confirmer').length;
  const toShip = ventes.filter(needsShipping).length;
  const delivered = ventes.filter((v) => v.statut === 'livree').length;
  const echeance = abonnement.echeanceCourante;

  const kpis = [
    { label: 'En ligne', value: online, icon: Tag, color: 'bg-shop-100 text-shop-700' },
    { label: 'Ventes', value: ventes.length, icon: Receipt, color: 'bg-primary-100 text-primary-600' },
    { label: 'Livrées', value: delivered, icon: BadgeCheck, color: 'bg-emerald-100 text-emerald-700' },
  ];

  const todos = [
    toConfirm > 0 && { to: `${ROUTES.MARKETPLACE_SALES}?onglet=confirm`, icon: Hourglass, text: `${toConfirm} paiement${toConfirm > 1 ? 's' : ''} à confirmer`, cls: 'bg-primary-50 text-primary-800' },
    toShip > 0 && { to: `${ROUTES.MARKETPLACE_SALES}?onglet=ship`, icon: Truck, text: `${toShip} livraison${toShip > 1 ? 's' : ''} à organiser`, cls: 'bg-amber-50 text-amber-900' },
    !loading && !blocked && moyens.filter((m) => m.actif).length === 0 && {
      to: ROUTES.MARKETPLACE_PAYMENT_METHODS, icon: CreditCard, text: 'Ajoutez vos moyens de paiement', cls: 'bg-shop-100 text-shop-900',
    },
  ].filter(Boolean);

  const menu = [
    { to: ROUTES.MARKETPLACE_MY_LISTINGS, icon: Tag, color: 'bg-shop-100 text-shop-700', label: 'Mes annonces', sub: `${annonces.length} annonce${annonces.length > 1 ? 's' : ''}` },
    { to: ROUTES.MARKETPLACE_SALES, icon: Receipt, color: 'bg-primary-100 text-primary-600', label: 'Mes ventes', sub: `${ventes.length} commande${ventes.length > 1 ? 's' : ''}` },
    { to: ROUTES.MARKETPLACE_PAYMENT_METHODS, icon: CreditCard, color: 'bg-violet-100 text-violet-700', label: 'Moyens de paiement', sub: `${moyens.filter((m) => m.actif).length} actif(s)` },
    { to: ROUTES.MARKETPLACE_BALANCE, icon: Wallet, color: 'bg-teal-100 text-teal-600', label: 'Solde & historique', sub: 'Ventes cumulées' },
    {
      to: ROUTES.MARKETPLACE_SUBSCRIPTION,
      icon: BadgeCheck,
      color: 'bg-amber-100 text-amber-700',
      label: 'Abonnement',
      sub: abonnement.abonnement ? ECHEANCE_STATUTS[echeance?.statut]?.label ?? 'À jour' : 'Non démarré',
    },
  ];

  return (
    <div className="pb-6">
      <div className="brand-gradient safe-top relative overflow-hidden rounded-b-[2rem] pb-16">
        <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/[0.07]" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-shop-400/20" />
        <div className="page-container relative flex h-16 items-center justify-between">
          <button type="button" onClick={() => navigate(-1)} className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/15 transition active:scale-90" aria-label="Retour">
            <ChevronLeft size={21} strokeWidth={2.4} />
          </button>
          <span className="font-heading text-lg font-bold">Ma boutique</span>
          <Link to={ROUTES.MARKETPLACE} className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/15 transition active:scale-90" aria-label="Voir le catalogue">
            <Store size={20} />
          </Link>
        </div>
        <ShopBagArt size={78} className="pointer-events-none absolute right-5 top-[5.5rem] animate-float" />
        <div className="page-container relative mt-2 pr-24">
          <p className="text-caption text-white/75">Bonjour {user ? personName(user) : ''}</p>
          <p className="mt-3 flex items-center gap-1.5 text-caption text-white/75">
            Ventes cumulées <Info size={12} />
          </p>
          <p className="font-heading text-[32px] font-bold leading-tight">
            {solde === null ? '…' : <AnimatedNumber value={solde} format={(n) => formatMoney(n)} />}
          </p>
          <p className="text-caption text-white/60">Montant indicatif, commission déduite. Aucun retrait via l’application.</p>
        </div>
      </div>

      <div className="page-container relative -mt-10 space-y-4">
        <div className="grid grid-cols-3 gap-2.5">
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="flex flex-col items-center gap-1 rounded-[1.4rem] bg-white py-3.5 shadow-[0_16px_36px_-14px_rgba(15,23,42,0.28)]"
            >
              <span className={`icon-tile mb-0.5 h-9 w-9 rounded-xl ${k.color}`}>
                <k.icon size={17} />
              </span>
              <span className="font-heading text-xl font-bold text-surface-900">{loading ? '–' : <AnimatedNumber value={k.value} />}</span>
              <span className="text-caption text-surface-500">{k.label}</span>
            </motion.div>
          ))}
        </div>

        <AbonnementBanner />

        {blocked && (
          <Link to={ROUTES.MARKETPLACE_SUBSCRIPTION} className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-red-800">
            <Lock size={20} />
            <span className="flex-1 text-body">Votre espace vendeur est suspendu. Régularisez votre abonnement pour le réactiver.</span>
            <ChevronRight size={18} />
          </Link>
        )}

        {todos.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-body font-semibold text-surface-900">À faire</h2>
            {todos.map((t, i) => (
              <motion.div key={t.text} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                <Link to={t.to} className={`flex items-center gap-3 rounded-2xl p-3.5 transition active:scale-[0.99] ${t.cls}`}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70">
                    <t.icon size={18} />
                  </span>
                  <span className="flex-1 text-body font-semibold">{t.text}</span>
                  <ChevronRight size={18} className="opacity-60" />
                </Link>
              </motion.div>
            ))}
          </section>
        )}

        <Link to={ROUTES.MARKETPLACE_SELL} className="block">
          <motion.div whileTap={{ scale: 0.98 }} className="relative flex h-28 items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-br from-shop-200 to-shop-400 p-4 text-shop-950">
            <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/30" />
            <span className="relative icon-tile h-11 w-11 rounded-[14px] bg-white/50">
              <Plus size={22} strokeWidth={2.6} />
            </span>
            <span className="relative flex-1">
              <span className="block font-heading text-base font-semibold">Nouvelle annonce</span>
              <span className="block text-caption text-shop-900">Photos, prix, c’est en ligne.</span>
            </span>
            <EmptyTagArt className="pointer-events-none relative -mr-8 h-24 w-auto animate-float" />
          </motion.div>
        </Link>

        <section className="card divide-y divide-surface-100 overflow-hidden">
          {menu.map((m) => (
            <Link key={m.to} to={m.to} className="flex items-center gap-3 p-4 transition hover:bg-surface-50">
              <span className={`icon-tile h-10 w-10 rounded-[13px] ${m.color}`}>
                <m.icon size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold text-surface-900">{m.label}</span>
                <span className="block text-caption text-surface-500">{m.sub}</span>
              </span>
              {m.to === ROUTES.MARKETPLACE_SUBSCRIPTION && echeance?.statut && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[ECHEANCE_STATUTS[echeance.statut]?.tone ?? 'neutral']}`}>
                  {ECHEANCE_STATUTS[echeance.statut]?.label}
                </span>
              )}
              <ChevronRight size={16} className="text-surface-300" />
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
