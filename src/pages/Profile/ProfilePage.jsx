import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  Gift, FileText, LogOut, MessageCircle, User, ChevronRight,
  UserCog, KeyRound, MapPinned, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import { openAuthSheet } from '../../store/slices/uiSlice';
import { logout, updateAvatar } from '../../store/slices/authSlice';
import { ROUTES } from '../../routes';

function ProfileLink({ link }) {
  return (
    <Link to={link.to} className="flex items-center gap-3 p-4">
      <link.icon size={18} className={link.danger ? 'text-red-500' : 'text-surface-500'} />
      <span className={`flex-1 text-sm font-medium ${link.danger ? 'text-red-600' : 'text-surface-900'}`}>
        {link.label}
      </span>
      <ChevronRight size={16} className="text-surface-300" />
    </Link>
  );
}

export default function ProfilePage() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const user = useSelector((state) => state.auth.user);

  // Account settings — only meaningful once signed in (auth-gated routes).
  const accountLinks = [
    { to: ROUTES.PROFILE_EDIT, icon: UserCog, label: 'Modifier mon profil' },
    { to: ROUTES.PROFILE_PASSWORD, icon: KeyRound, label: 'Changer mon mot de passe' },
    { to: ROUTES.PROFILE_ADDRESSES, icon: MapPinned, label: 'Mes adresses favorites' },
    { to: ROUTES.PROFILE_REFERRAL, icon: Gift, label: 'Programme de parrainage' },
  ];

  const links = [
    { to: ROUTES.PROFILE_INVOICES, icon: FileText, label: 'Mes factures' },
  ];

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

  return (
    <div>
      <TopBar title="Profil" />
      <div className="page-container space-y-4 py-4">
        <div className="card flex items-center gap-3 p-4">
          <button
            type="button"
            onClick={isAuthenticated ? handleChangeAvatar : undefined}
            className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-50 text-primary-600"
            aria-label={isAuthenticated ? 'Modifier la photo de profil' : undefined}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <User size={22} />
            )}
          </button>
          <div className="min-w-0 flex-1">
            {isAuthenticated ? (
              <>
                <p className="font-semibold text-surface-900">
                  {[user?.nom, user?.prenoms].filter(Boolean).join(' ') || 'Client TourShop'}
                </p>
                <p className="text-sm text-surface-500">{user?.email || user?.telephone}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-surface-900">Invite</p>
                <button
                  type="button"
                  className="text-sm font-medium text-primary-600"
                  onClick={() => dispatch(openAuthSheet({ mode: 'login', reason: 'default' }))}
                >
                  Se connecter / Créer un compte
                </button>
              </>
            )}
          </div>
        </div>

        {isAuthenticated && (
          <div className="card divide-y divide-surface-100">
            {accountLinks.map((link) => (
              <ProfileLink key={link.to} link={link} />
            ))}
          </div>
        )}

        <div className="card divide-y divide-surface-100">
          {links.map((link) => (
            <ProfileLink key={link.to} link={link} />
          ))}
          <a
            href="https://wa.me/message"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 p-4"
          >
            <MessageCircle size={18} className="text-surface-500" />
            <span className="flex-1 text-sm font-medium text-surface-900">Contacter le support</span>
            <ChevronRight size={16} className="text-surface-300" />
          </a>
        </div>

        {isAuthenticated && (
          <>
            <div className="card divide-y divide-surface-100">
              <ProfileLink link={{ to: ROUTES.PROFILE_DELETE, icon: Trash2, label: 'Supprimer mon compte', danger: true }} />
            </div>
            <button
              type="button"
              onClick={() => dispatch(logout())}
              className="btn-secondary w-full text-red-600"
            >
              <LogOut size={16} /> Se deconnecter
            </button>
          </>
        )}
      </div>
    </div>
  );
}
