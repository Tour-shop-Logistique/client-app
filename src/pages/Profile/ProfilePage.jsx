import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Gift, FileText, LogOut, MessageCircle, User, ChevronRight } from 'lucide-react';
import TopBar from '../../components/common/TopBar';
import { openAuthSheet } from '../../store/slices/uiSlice';
import { logout } from '../../store/slices/authSlice';
import { ROUTES } from '../../routes';

function ProfileLink({ link }) {
  return (
    <Link to={link.to} className="flex items-center gap-3 p-4">
      <link.icon size={18} className="text-surface-500" />
      <span className="flex-1 text-sm font-medium text-surface-900">{link.label}</span>
      <ChevronRight size={16} className="text-surface-300" />
    </Link>
  );
}

export default function ProfilePage() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const user = useSelector((state) => state.auth.user);

  const links = [
    { to: ROUTES.PROFILE_REFERRAL, icon: Gift, label: 'Programme de parrainage' },
    { to: ROUTES.PROFILE_INVOICES, icon: FileText, label: 'Mes factures' },
  ];

  return (
    <div>
      <TopBar title="Profil" />
      <div className="page-container space-y-4 py-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <User size={22} />
          </span>
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
          <button
            type="button"
            onClick={() => dispatch(logout())}
            className="btn-secondary w-full text-red-600"
          >
            <LogOut size={16} /> Se deconnecter
          </button>
        )}
      </div>
    </div>
  );
}
