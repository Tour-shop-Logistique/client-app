import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { Plus, Trash2, MapPinned } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import EmptyState from '../../components/common/EmptyState';
import { updateFavoriteAddresses } from '../../store/slices/authSlice';
import { ROUTES } from '../../routes';

const EMPTY_ROW = { nom: '', adresse: '', ville: '', code_postal: '', pays: '' };

// PUT /api/profile/favorite-addresses replaces the WHOLE list every call, so the
// screen edits the full array locally and sends it in one shot. A plain address
// book to prefill expedition forms — no geo/tariff validation server-side.
export default function FavoriteAddressesPage() {
  const dispatch = useDispatch();
  const { user, isAuthenticated, status, error } = useSelector((s) => s.auth);

  const [rows, setRows] = useState(() =>
    Array.isArray(user?.adresses_favoris) && user.adresses_favoris.length
      ? user.adresses_favoris.map((a) => ({ ...EMPTY_ROW, ...a }))
      : []
  );
  const loading = status === 'loading';

  if (!isAuthenticated) return <Navigate to={ROUTES.PROFILE} replace />;

  const setField = (i, name) => (e) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [name]: e.target.value } : r)));

  const addRow = () => setRows((rs) => [...rs, { ...EMPTY_ROW }]);
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    // Drop fully-empty rows; nom + adresse are required on the rest.
    const cleaned = rows
      .map((r) => ({
        nom: r.nom.trim(),
        adresse: r.adresse.trim(),
        ville: r.ville.trim() || null,
        code_postal: r.code_postal.trim() || null,
        pays: r.pays.trim() || null,
      }))
      .filter((r) => r.nom || r.adresse);

    if (cleaned.some((r) => !r.nom || !r.adresse)) {
      toast.error('Chaque adresse a besoin d’un libellé et d’une adresse.');
      return;
    }

    const result = await dispatch(updateFavoriteAddresses(cleaned));
    if (updateFavoriteAddresses.fulfilled.match(result)) {
      setRows(cleaned.map((a) => ({ ...EMPTY_ROW, ...a })));
      toast.success('Adresses favorites mises à jour.');
    }
  };

  return (
    <div>
      <TopBar title="Mes adresses favorites" back />
      <div className="page-container space-y-4 py-4">
        {error && <p className="text-sm text-red-600">{error}</p>}

        {rows.length === 0 && (
          <EmptyState
            icon={MapPinned}
            title="Aucune adresse enregistrée"
            description="Ajoutez vos adresses habituelles pour préremplir vos formulaires d'expédition."
          />
        )}

        {rows.map((row, i) => (
          <div key={i} className="card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-surface-400">
                Adresse {i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="rounded-full p-1.5 text-red-500 hover:bg-red-50"
                aria-label="Supprimer cette adresse"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <label className="block text-sm font-medium text-surface-700">
              Libellé
              <input
                className="input-field mt-1.5" placeholder="Domicile, Bureau…"
                value={row.nom} onChange={setField(i, 'nom')}
              />
            </label>
            <label className="block text-sm font-medium text-surface-700">
              Adresse
              <input
                className="input-field mt-1.5" placeholder="Rue, quartier, immeuble…"
                value={row.adresse} onChange={setField(i, 'adresse')}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-surface-700">
                Ville
                <input className="input-field mt-1.5" value={row.ville} onChange={setField(i, 'ville')} />
              </label>
              <label className="block text-sm font-medium text-surface-700">
                Code postal
                <input className="input-field mt-1.5" value={row.code_postal} onChange={setField(i, 'code_postal')} />
              </label>
            </div>
            <label className="block text-sm font-medium text-surface-700">
              Pays
              <input className="input-field mt-1.5" value={row.pays} onChange={setField(i, 'pays')} />
            </label>
          </div>
        ))}

        <button type="button" onClick={addRow} className="btn-secondary w-full">
          <Plus size={16} /> Ajouter une adresse
        </button>

        <button type="button" onClick={handleSave} className="btn-primary w-full" disabled={loading}>
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
