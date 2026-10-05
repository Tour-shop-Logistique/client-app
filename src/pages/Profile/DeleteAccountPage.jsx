import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Navigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import PageIntro from '../../components/common/PageIntro';
import { deleteAccount } from '../../store/slices/authSlice';
import { ROUTES } from '../../routes';

function FieldError({ errors, name }) {
  const msg = errors?.[name]?.[0];
  return msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null;
}

// DELETE /api/profile/delete-account — soft delete (is_deleted + actif = false),
// revokes every token, password verified first. Afterwards `login` answers
// "Votre compte est désactivé.".
export default function DeleteAccountPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, status, fieldErrors, error } = useSelector((s) => s.auth);

  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const loading = status === 'loading';

  if (!isAuthenticated) return <Navigate to={ROUTES.PROFILE} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirmed) {
      toast.error('Veuillez confirmer la suppression.');
      return;
    }
    const result = await dispatch(deleteAccount(password));
    if (!deleteAccount.fulfilled.match(result)) return;

    toast.success(result.payload.message || 'Compte supprimé.');
    navigate(ROUTES.HOME);
  };

  return (
    <div>
      <TopBar title="Supprimer mon compte" back />
      <div className="page-container space-y-4 py-4">
        <PageIntro
          icon={AlertTriangle}
          tone="danger"
          title="Action définitive"
          text="La suppression désactive votre compte : vous ne pourrez plus vous connecter et vos données ne seront plus accessibles depuis l'application."
        />
        {error && <p className="text-sm text-red-600">{error}</p>}

        <form onSubmit={handleSubmit} className="card space-y-4 p-4">
          <label className="block text-sm font-medium text-surface-700">
            Confirmez avec votre mot de passe
            <input
              type="password" autoComplete="current-password"
              className="input-field mt-1.5" value={password} onChange={(e) => setPassword(e.target.value)} required
            />
            <FieldError errors={fieldErrors} name="password" />
          </label>

          <label className="flex items-start gap-2.5 rounded-xl bg-surface-50 p-3 text-sm text-surface-700">
            <input
              type="checkbox" className="mt-0.5 h-4 w-4 accent-red-600"
              checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
            />
            Je comprends que mon compte sera désactivé de façon définitive.
          </label>

          <button
            type="submit"
            className="btn w-full bg-red-600 text-white hover:bg-red-700"
            disabled={loading || !confirmed}
          >
            {loading ? 'Suppression…' : 'Supprimer définitivement mon compte'}
          </button>
        </form>
      </div>
    </div>
  );
}
