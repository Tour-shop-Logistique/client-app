import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import { changePassword } from '../../store/slices/authSlice';
import { openAuthSheet } from '../../store/slices/uiSlice';
import { ROUTES } from '../../routes';

function FieldError({ errors, name }) {
  const msg = errors?.[name]?.[0];
  return msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null;
}

// PUT /api/profile/change-password — verifies the current password, then revokes
// every token. On success the session is gone and the user must log in again.
export default function ChangePasswordPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, status, fieldErrors, error } = useSelector((s) => s.auth);

  const [form, setForm] = useState({ currentPassword: '', password: '', passwordConfirmation: '' });
  const loading = status === 'loading';

  if (!isAuthenticated) return <Navigate to={ROUTES.PROFILE} replace />;

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Le nouveau mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (form.password !== form.passwordConfirmation) {
      toast.error('Les deux mots de passe ne correspondent pas.');
      return;
    }
    const result = await dispatch(changePassword(form));
    if (!changePassword.fulfilled.match(result)) return;

    toast.success(result.payload.message || 'Mot de passe changé. Veuillez vous reconnecter.');
    // Tokens were revoked server-side: bounce to a fresh login.
    navigate(ROUTES.PROFILE);
    dispatch(openAuthSheet({ mode: 'login', reason: 'default' }));
  };

  return (
    <div>
      <TopBar title="Changer mon mot de passe" back />
      <div className="page-container py-4">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <p className="mb-4 text-sm text-surface-500">
          Par sécurité, changer le mot de passe déconnecte toutes vos sessions. Vous devrez vous
          reconnecter avec le nouveau mot de passe.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-surface-700">
            Mot de passe actuel
            <input
              type="password" autoComplete="current-password"
              className="input-field mt-1.5" value={form.currentPassword} onChange={set('currentPassword')} required
            />
            <FieldError errors={fieldErrors} name="current_password" />
          </label>
          <label className="block text-sm font-medium text-surface-700">
            Nouveau mot de passe (8 caractères min.)
            <input
              type="password" autoComplete="new-password" minLength={8}
              className="input-field mt-1.5" value={form.password} onChange={set('password')} required
            />
            <FieldError errors={fieldErrors} name="password" />
          </label>
          <label className="block text-sm font-medium text-surface-700">
            Confirmer le nouveau mot de passe
            <input
              type="password" autoComplete="new-password" minLength={8}
              className="input-field mt-1.5" value={form.passwordConfirmation} onChange={set('passwordConfirmation')} required
            />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Modification…' : 'Changer le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}
