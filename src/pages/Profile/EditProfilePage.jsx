import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Navigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import PhoneInput, { isPossiblePhoneNumber, parsePhoneNumber } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import 'react-phone-number-input/style.css';
import TopBar from '../../components/common/TopBar';
import CountrySelectSheet from '../../components/common/CountrySelectSheet';
import { getFlagEmoji, getCountryName } from '../../utils/countries';
import { splitPhone, joinPhone } from '../../utils/phone';
import { updateProfile } from '../../store/slices/authSlice';
import { openAuthSheet } from '../../store/slices/uiSlice';
import { ROUTES } from '../../routes';

function FieldError({ errors, name }) {
  const msg = errors?.[name]?.[0];
  return msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null;
}

// Normalise whatever the backend stored into an E.164 string PhoneInput can
// display: preferred is the split pair (`indicatif_telephone` + national
// `telephone`); fall back to a bare E.164 or a legacy local number.
const seedPhone = (u) => {
  if (u?.indicatif_telephone) return joinPhone(u.indicatif_telephone, u.telephone);
  const value = u?.telephone || '';
  if (value.startsWith('+')) return value;
  try {
    return parsePhoneNumber(value, (u?.code_pays || 'CI').toUpperCase())?.number || '';
  } catch {
    return '';
  }
};

// PUT /api/profile/update — every field is optional; we send only what changed.
// Changing the email triggers a re-verification of the NEW address.
export default function EditProfilePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated, status, fieldErrors, error } = useSelector((s) => s.auth);

  const initial = useMemo(
    () => ({
      nom: user?.nom || '',
      prenoms: user?.prenoms || '',
      telephone: seedPhone(user),
      email: user?.email || '',
      codePays: (user?.code_pays || '').toUpperCase(),
    }),
    [user]
  );

  const [form, setForm] = useState(initial);
  const [countrySheetOpen, setCountrySheetOpen] = useState(false);
  const loading = status === 'loading';

  if (!isAuthenticated) return <Navigate to={ROUTES.PROFILE} replace />;

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const phoneChanged = form.telephone !== initial.telephone;
    if (phoneChanged && (!form.telephone || !isPossiblePhoneNumber(form.telephone))) {
      toast.error('Numéro de téléphone invalide.');
      return;
    }

    // Diff against the loaded values — only changed fields go to the API.
    const changes = {};
    if (form.nom.trim() !== initial.nom) changes.nom = form.nom.trim();
    if (form.prenoms.trim() !== initial.prenoms) changes.prenoms = form.prenoms.trim() || null;
    if (phoneChanged) {
      // The API wants the dialing code and the national number in separate fields.
      const { indicatif, national } = splitPhone(form.telephone);
      changes.telephone = national;
      changes.indicatifTelephone = indicatif || null;
    }
    if (form.email.trim() !== initial.email) changes.email = form.email.trim();
    if (form.codePays && form.codePays !== initial.codePays) changes.codePays = form.codePays;

    if (Object.keys(changes).length === 0) {
      toast.info('Aucune modification à enregistrer.');
      return;
    }

    const result = await dispatch(updateProfile(changes));
    if (!updateProfile.fulfilled.match(result)) return;

    toast.success(result.payload.message || 'Profil mis à jour.');
    if (result.payload.emailChanged) {
      // New address is unverified — send the user straight to the code screen.
      toast.info('Un code de vérification a été envoyé à votre nouvelle adresse email.');
      dispatch(openAuthSheet({ mode: 'verify', reason: 'default' }));
    }
    navigate(ROUTES.PROFILE);
  };

  return (
    <div>
      <TopBar title="Modifier mon profil" back />
      <div className="page-container py-4">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-surface-700">
              Nom
              <input className="input-field mt-1.5" value={form.nom} onChange={set('nom')} required />
              <FieldError errors={fieldErrors} name="nom" />
            </label>
            <label className="block text-sm font-medium text-surface-700">
              Prénoms
              <input className="input-field mt-1.5" value={form.prenoms} onChange={set('prenoms')} />
              <FieldError errors={fieldErrors} name="prenoms" />
            </label>
          </div>

          <div className="text-sm font-medium text-surface-700">
            Pays
            <button
              type="button"
              onClick={() => setCountrySheetOpen(true)}
              className="input-field mt-1.5 flex w-full items-center justify-between text-left"
            >
              {form.codePays ? (
                <span className="flex items-center gap-2 text-surface-900">
                  <span className="text-base leading-none">{getFlagEmoji(form.codePays)}</span>
                  {getCountryName(form.codePays)}
                </span>
              ) : (
                <span className="text-surface-400">Sélectionnez votre pays</span>
              )}
              <MapPin size={16} className="shrink-0 text-surface-400" />
            </button>
            <p className="mt-1 text-xs text-surface-400">
              Détermine votre agence de rattachement et votre tarification. Effectif immédiatement.
            </p>
            <FieldError errors={fieldErrors} name="code_pays" />
          </div>

          <div className="text-sm font-medium text-surface-700">
            Téléphone
            <PhoneInput
              key={form.codePays || 'CI'}
              className="phone-field mt-1.5"
              flags={flags}
              international
              countryCallingCodeEditable={false}
              defaultCountry={(form.codePays || 'CI').toUpperCase()}
              value={form.telephone}
              onChange={(value) => setForm((f) => ({ ...f, telephone: value || '' }))}
              numberInputProps={{ autoComplete: 'tel' }}
              placeholder="01 02 03 04 05"
            />
            <FieldError errors={fieldErrors} name="telephone" />
          </div>

          <label className="block text-sm font-medium text-surface-700">
            Email
            <input
              type="email" inputMode="email" autoComplete="email"
              className="input-field mt-1.5" value={form.email} onChange={set('email')} required
            />
            <p className="mt-1 text-xs text-surface-400">
              Changer d'email demande une nouvelle vérification par code sur la nouvelle adresse.
            </p>
            <FieldError errors={fieldErrors} name="email" />
          </label>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </div>

      <CountrySelectSheet
        open={countrySheetOpen}
        onClose={() => setCountrySheetOpen(false)}
        currentCode={form.codePays}
        onSelect={(code) => setForm((f) => ({ ...f, codePays: code }))}
        title="Votre pays"
        description="Le pays du compte détermine votre agence de rattachement et votre tarification."
      />
    </div>
  );
}
