import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  FileText, LogOut, MessageCircle, ChevronRight, ArrowRight, Camera, MapPin, Package,
  UserCog, KeyRound, MapPinned, Trash2, ShoppingBag, Store, Bell, Loader2, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { openAuthSheet } from '../../store/slices/uiSlice';
import { logout, updateAvatar } from '../../store/slices/authSlice';
import usePushSubscription from '../../hooks/usePushSubscription';
import { GiftArt } from '../../components/illustrations';
import { getCountryName } from '../../utils/countries';
import { fullUserName, userInitials } from '../../utils/user';
import { ROUTES } from '../../routes';

const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP || '').replace(/\D/g, '');

// Raccourcis d'activité en pastilles colorées (kit visuel).
const ACTIVITY = [
  { to: ROUTES.EXPEDITION_HISTORY, icon: Package, label: 'Mes colis', color: 'bg-primary-100 text-primary-600' },
  { to: ROUTES.MARKETPLACE_ORDERS, icon: ShoppingBag, label: 'Mes achats', color: 'bg-shop-100 text-shop-700' },
  { to: ROUTES.MARKETPLACE_SELLER, icon: Store, label: 'Ma boutique', color: 'bg-violet-100 text-violet-700' },
  { to: ROUTES.PROFILE_INVOICES, icon: FileText, label: 'Factures', color: 'bg-teal-100 text-teal-600' },
];

const ACCOUNT_LINKS = [
  { to: ROUTES.PROFILE_EDIT, icon: UserCog, label: 'Modifier mon profil', hint: 'Nom, téléphone, email, pays', color: 'bg-primary-100 text-primary-600' },
  { to: ROUTES.PROFILE_PASSWORD, icon: KeyRound, label: 'Mot de passe', hint: 'Changer mon mot de passe', color: 'bg-violet-100 text-violet-700' },
  { to: ROUTES.PROFILE_ADDRESSES, icon: MapPinned, label: 'Adresses favorites', hint: 'Préremplir mes envois', color: 'bg-teal-100 text-teal-600' },
];

function RowContent({ icon, color, label, hint, danger, trailing }) {
  const Icon = icon;
  return (
    <>
      <span className={`icon-tile h-10 w-10 rounded-[13px] ${danger ? 'bg-red-100 text-red-600' : color}`}>
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${danger ? 'text-red-600' : 'text-surface-900'}`}>{label}</span>
        {hint && <span className="block truncate text-caption text-surface-500">{hint}</span>}
      </span>
      {trailing ?? <ChevronRight size={18} className="shrink-0 text-surface-400" />}
    </>
  );
}

function MenuRow({ link }) {
  return (
    <Link to={link.to} className="flex items-center gap-3 px-4 py-3 transition active:bg-surface-50">
      <RowContent {...link} />
    </Link>
  );
}

function MenuSection({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-caption font-semibold uppercase tracking-wide text-surface-500">{title}</h2>
      <div className="card divide-y divide-surface-100 overflow-hidden">{children}</div>
    </section>
  );
}

// Notifications push de cet appareil (colis livré, parrainage, abonnement…).
function PushToggle() {
  const { supported, ready, enabled, loading, toggle } = usePushSubscription();
  if (!supported) return null;

  const onToggle = async () => {
    const res = await toggle();
    if (!res.ok) toast.error(res.message || 'Action impossible.');
    else toast.success(res.enabled ? 'Notifications activées sur cet appareil.' : 'Notifications désactivées.');
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      disabled={!ready || loading}
      className="flex w-full items-center gap-3 px-4 py-3 text-left"
    >
      <RowContent
        icon={Bell}
        color="bg-amber-100 text-amber-700"
        label="Notifications"
        hint="Colis livré, commandes, parrainage"
        trailing={
          loading ? (
            <Loader2 size={18} className="animate-spin text-surface-400" />
          ) : (
            <span className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${enabled ? 'bg-primary-600' : 'bg-surface-300'}`}>
              <span className={`inline-block h-[22px] w-[22px] rounded-full bg-white shadow transition ${enabled ? 'translate-x-[23px]' : 'translate-x-[3px]'}`} />
            </span>
          )
        }
      />
    </button>
  );
}

export default function ProfilePage() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const user = useSelector((state) => state.auth.user);
  const countryCode = (user?.code_pays || '').toUpperCase();

  // PUT /api/profile/avatar takes a plain URL string (no upload endpoint exists),
  // so we ask for the already-hosted image URL.
  const handleChangeAvatar = async () => {
    const url = window.prompt("URL de la photo de profil (image déjà hébergée en ligne) :", user?.avatar || '');
    if (url === null) return;
    const trimmed = url.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast.error('Entrez une URL commençant par http(s)://');
      return;
    }
    const result = await dispatch(updateAvatar(trimmed));
    if (updateAvatar.fulfilled.match(result)) toast.success('Photo de profil mise à jour.');
  };

  const openLogin = () => dispatch(openAuthSheet({ mode: 'login', reason: 'default' }));

  return (
    <div className="pb-4">
      {/* En-tête illustré */}
      <div className="brand-gradient safe-top relative overflow-hidden rounded-b-[2rem] pb-16">
        <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/[0.07]" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-shop-400/20" />

        <div className="page-container relative pt-5">
          <h1 className="font-heading text-lg font-bold">Profil</h1>

          <div className="mt-5 flex items-center gap-4">
            <button
              type="button"
              onClick={isAuthenticated ? handleChangeAvatar : openLogin}
              className="relative shrink-0"
              aria-label={isAuthenticated ? 'Modifier la photo de profil' : 'Se connecter'}
            >
              <span className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-shop-400 font-heading text-2xl font-bold text-shop-950 ring-4 ring-white/25">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                ) : isAuthenticated && userInitials(user) ? (
                  userInitials(user)
                ) : (
                  <User size={30} />
                )}
              </span>
              {isAuthenticated && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary-700 shadow-md">
                  <Camera size={14} strokeWidth={2.4} />
                </span>
              )}
            </button>

            <div className="min-w-0 flex-1">
              {isAuthenticated ? (
                <>
                  <p className="truncate font-heading text-xl font-bold">{fullUserName(user)}</p>
                  <p className="truncate text-body text-white/85">{user?.email || user?.telephone}</p>
                  {countryCode && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-caption font-semibold">
                      <MapPin size={12} className="text-shop-300" strokeWidth={2.6} /> {getCountryName(countryCode)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <p className="font-heading text-xl font-bold">Bienvenue !</p>
                  <p className="text-body text-white/85">Connectez-vous pour suivre vos colis et vos achats.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="page-container relative z-10 -mt-10 space-y-5">
        {isAuthenticated ? (
          <div className="grid grid-cols-4 gap-1 rounded-[1.4rem] bg-white px-2 py-4 shadow-[0_16px_36px_-14px_rgba(15,23,42,0.28)]">
            {ACTIVITY.map((a) => (
              <Link key={a.label} to={a.to} className="flex flex-col items-center gap-2 text-center text-caption font-semibold text-surface-700">
                <span className={`icon-tile h-[52px] w-[52px] rounded-[17px] transition active:scale-90 ${a.color}`}>
                  <a.icon size={22} />
                </span>
                {a.label}
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.4rem] bg-white p-4 shadow-[0_16px_36px_-14px_rgba(15,23,42,0.28)]">
            <button type="button" className="btn-primary w-full" onClick={openLogin}>
              Se connecter / Créer un compte
            </button>
          </div>
        )}

        {isAuthenticated && (
          <Link to={ROUTES.PROFILE_REFERRAL} className="relative block h-32 overflow-hidden rounded-3xl bg-navy-800 p-[18px] text-white">
            <div className="pointer-events-none absolute -bottom-10 -right-8 h-36 w-36 rounded-full bg-shop-400/15" />
            <span className="relative inline-block rounded-full bg-shop-400 px-2.5 py-0.5 text-[11px] font-bold text-shop-950">Parrainage</span>
            <p className="relative mb-2 mt-2 w-48 font-heading text-base font-semibold leading-[21px]">Invitez vos proches, gagnez des bonus</p>
            <span className="relative inline-flex items-center gap-1.5 text-body font-semibold text-shop-300">
              Mon code <ArrowRight size={15} strokeWidth={2.4} />
            </span>
            <GiftArt className="pointer-events-none absolute right-3 top-3 animate-float" />
          </Link>
        )}

        {isAuthenticated && (
          <MenuSection title="Mon compte">
            {ACCOUNT_LINKS.map((link) => (
              <MenuRow key={link.to} link={link} />
            ))}
            <PushToggle />
          </MenuSection>
        )}

        {/* Numero WhatsApp du support (format international, chiffres seuls),
            fourni au build : sans lui, aucun lien plutot qu'un lien mort. */}
        {SUPPORT_WHATSAPP && (
          <MenuSection title="Aide">
            <a
              href={`https://wa.me/${SUPPORT_WHATSAPP}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-4 py-3 transition active:bg-surface-50"
            >
              <RowContent icon={MessageCircle} color="bg-emerald-100 text-emerald-700" label="Contacter le support" hint="Réponse sur WhatsApp" />
            </a>
          </MenuSection>
        )}

        {isAuthenticated && (
          <>
            <MenuSection title="Zone sensible">
              <MenuRow link={{ to: ROUTES.PROFILE_DELETE, icon: Trash2, label: 'Supprimer mon compte', danger: true }} />
            </MenuSection>
            <button type="button" onClick={() => dispatch(logout())} className="btn-secondary w-full text-red-600">
              <LogOut size={16} /> Se déconnecter
            </button>
          </>
        )}
      </div>
    </div>
  );
}
