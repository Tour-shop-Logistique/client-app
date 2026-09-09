import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Mail, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import PhoneInput, { isPossiblePhoneNumber } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import 'react-phone-number-input/style.css';
import BottomSheet from '../common/BottomSheet';
import CountrySelectSheet from '../common/CountrySelectSheet';
import { getFlagEmoji, getCountryName } from '../../utils/countries';
import { closeAuthSheet } from '../../store/slices/uiSlice';
import {
  registerClient,
  verifyEmailCode,
  resendVerification,
  loginClient,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  resetAuthFlow,
  clearAuthError,
} from '../../store/slices/authSlice';
import { flushPendingAuthAction, clearPendingAuthAction } from '../../hooks/useRequireAuth';

const REASON_LABELS = {
  expedition: 'Connectez-vous pour valider votre expédition.',
  marketplace_order: 'Connectez-vous pour valider votre commande.',
  default: 'Connectez-vous ou créez un compte pour continuer.',
};

const TITLES = {
  login: 'Connexion',
  register: 'Créer un compte',
  verify: 'Vérifier votre email',
  forgot: 'Mot de passe oublié',
  reset: 'Nouveau mot de passe',
};

const EMPTY_FORM = {
  nom: '',
  prenoms: '',
  telephone: '',
  email: '',
  password: '',
  passwordConfirmation: '',
  code: '',
  // register only: code_pays is mandatory for a client, code_parrain is optional
  codePays: '',
  codeParrain: '',
};

// A referral code can reach a new client through a share link
// (?parrain= / ?ref= / ?code_parrain=). Read it once at module load.
const referralFromUrl = (() => {
  try {
    const p = new URLSearchParams(window.location.search);
    return (p.get('parrain') || p.get('ref') || p.get('code_parrain') || '').trim().toUpperCase();
  } catch {
    return '';
  }
})();

function FieldError({ errors, name }) {
  const msg = errors?.[name]?.[0];
  return msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null;
}

// Email-based auth (api-authentification-client.md). Guest-first: this sheet
// only appears when the user confirms a major action or opens it from Profil.
// Mandatory new-client path: register -> verify -> auto-login.
export default function AuthSheet() {
  const dispatch = useDispatch();
  const { open, reason, mode: initialMode } = useSelector((state) => state.ui.authSheet);
  const { status, error, fieldErrors, pendingEmail } = useSelector((state) => state.auth);
  const storedCountryCode = useSelector((state) => state.country.code);

  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(EMPTY_FORM);
  const [countrySheetOpen, setCountrySheetOpen] = useState(false);

  const loading = status === 'loading';

  // Seed the form only on the rising edge of `open`: registering dispatches
  // setCountry, which would otherwise re-trigger this and wipe the form while
  // the user is on the verify step. The register step is pre-filled with the
  // country already remembered app-wide and a referral code from the URL.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      wasOpen.current = true;
      setMode(initialMode || 'login');
      setForm({ ...EMPTY_FORM, codePays: storedCountryCode || '', codeParrain: referralFromUrl });
      dispatch(clearAuthError());
    } else if (!open) {
      wasOpen.current = false;
    }
  }, [open, initialMode, dispatch, storedCountryCode]);

  const goTo = useCallback((next) => {
    dispatch(clearAuthError());
    setMode(next);
  }, [dispatch]);

  const handleClose = () => {
    clearPendingAuthAction();
    dispatch(resetAuthFlow());
    dispatch(closeAuthSheet());
  };

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  // Called after a real token is obtained (login succeeded).
  const finishAuthenticated = () => {
    toast.success('Connexion réussie.');
    dispatch(closeAuthSheet());
    dispatch(resetAuthFlow());
    flushPendingAuthAction();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const result = await dispatch(loginClient({ email: form.email.trim(), password: form.password }));
    if (loginClient.fulfilled.match(result)) finishAuthenticated();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirmation) {
      toast.error('Les deux mots de passe ne correspondent pas.');
      return;
    }
    // code_pays is required for a client — the API answers 422 without it.
    if (!form.codePays) {
      toast.error('Sélectionnez votre pays.');
      return;
    }
    // Phone must carry a dialing code + a plausible national number (E.164).
    if (!form.telephone || !isPossiblePhoneNumber(form.telephone)) {
      toast.error('Numéro de téléphone invalide.');
      return;
    }
    const result = await dispatch(registerClient({
      nom: form.nom.trim(),
      prenoms: form.prenoms.trim(),
      telephone: form.telephone.trim(),
      email: form.email.trim(),
      password: form.password,
      passwordConfirmation: form.passwordConfirmation,
      codePays: form.codePays,
      codeParrain: form.codeParrain.trim() || undefined,
    }));
    if (registerClient.fulfilled.match(result)) {
      toast.success('Code de vérification envoyé par email.');
      goTo('verify');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const email = (pendingEmail || form.email).trim();
    const result = await dispatch(verifyEmailCode({ email, code: form.code.trim() }));
    if (!verifyEmailCode.fulfilled.match(result)) return;

    // Email verified -> log in straight away if we still hold the password.
    if (form.password) {
      const login = await dispatch(loginClient({ email, password: form.password }));
      if (loginClient.fulfilled.match(login)) {
        finishAuthenticated();
        return;
      }
    }
    toast.success('Email vérifié. Connectez-vous.');
    setForm({ ...EMPTY_FORM, email });
    goTo('login');
  };

  const handleResend = async () => {
    const email = (pendingEmail || form.email).trim();
    const result = await dispatch(resendVerification(email));
    if (resendVerification.fulfilled.match(result)) toast.success('Nouveau code envoyé.');
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    const result = await dispatch(forgotPassword(form.email.trim()));
    if (forgotPassword.fulfilled.match(result)) {
      toast.success('Code de réinitialisation envoyé par email.');
      goTo('reset');
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirmation) {
      toast.error('Les deux mots de passe ne correspondent pas.');
      return;
    }
    const email = (pendingEmail || form.email).trim();
    const code = form.code.trim();
    const check = await dispatch(verifyResetCode({ email, code }));
    if (!verifyResetCode.fulfilled.match(check)) return;

    const result = await dispatch(resetPassword({
      email,
      code,
      password: form.password,
      passwordConfirmation: form.passwordConfirmation,
    }));
    if (resetPassword.fulfilled.match(result)) {
      toast.success('Mot de passe réinitialisé. Connectez-vous.');
      setForm({ ...EMPTY_FORM, email });
      goTo('login');
    }
  };

  const verifyEmailAddress = pendingEmail || form.email;

  return (
    <>
    <BottomSheet open={open} onClose={handleClose} title={TITLES[mode]}>
      <p className="mb-4 flex items-start gap-2 text-sm text-surface-500">
        <Mail size={18} className="mt-0.5 shrink-0 text-primary-600" />
        {REASON_LABELS[reason] || REASON_LABELS.default}
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {mode === 'login' && (
        <form onSubmit={handleLogin} className="space-y-3">
          <label className="block text-sm font-medium text-surface-700">
            Email
            <input
              type="email" inputMode="email" autoComplete="email"
              className="input-field mt-1.5" value={form.email} onChange={set('email')} autoFocus required
            />
            <FieldError errors={fieldErrors} name="email" />
          </label>
          <label className="block text-sm font-medium text-surface-700">
            Mot de passe
            <input
              type="password" autoComplete="current-password"
              className="input-field mt-1.5" value={form.password} onChange={set('password')} required
            />
            <FieldError errors={fieldErrors} name="password" />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
          <div className="flex items-center justify-between pt-1 text-sm">
            <button type="button" className="font-medium text-primary-600" onClick={() => goTo('register')}>
              Créer un compte
            </button>
            <button type="button" className="text-surface-500" onClick={() => goTo('forgot')}>
              Mot de passe oublié ?
            </button>
          </div>
        </form>
      )}

      {mode === 'register' && (
        <form onSubmit={handleRegister} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-surface-700">
              Nom
              <input className="input-field mt-1.5" value={form.nom} onChange={set('nom')} autoFocus required />
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
            <FieldError errors={fieldErrors} name="code_pays" />
          </div>
          <div className="text-sm font-medium text-surface-700">
            Téléphone
            {/* Indicatif pays (+225, +33…) via liste déroulante + numéro national.
                react-phone-number-input renvoie la valeur au format E.164
                (ex. "+2250102030405") qu'on envoie telle quelle à l'API. */}
            <PhoneInput
              key={form.codePays || 'CI'}
              className="phone-field mt-1.5"
              flags={flags}
              international
              countryCallingCodeEditable={false}
              defaultCountry={(form.codePays || 'CI').toUpperCase()}
              value={form.telephone}
              onChange={(value) => setForm((f) => ({ ...f, telephone: value || '' }))}
              numberInputProps={{ autoComplete: 'tel', required: true }}
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
            <FieldError errors={fieldErrors} name="email" />
          </label>
          <label className="block text-sm font-medium text-surface-700">
            Mot de passe (8 caractères min.)
            <input
              type="password" autoComplete="new-password" minLength={8}
              className="input-field mt-1.5" value={form.password} onChange={set('password')} required
            />
            <FieldError errors={fieldErrors} name="password" />
          </label>
          <label className="block text-sm font-medium text-surface-700">
            Confirmer le mot de passe
            <input
              type="password" autoComplete="new-password" minLength={8}
              className="input-field mt-1.5" value={form.passwordConfirmation} onChange={set('passwordConfirmation')} required
            />
          </label>
          <label className="block text-sm font-medium text-surface-700">
            Code de parrainage (facultatif)
            <input
              type="text" autoCapitalize="characters" autoComplete="off"
              placeholder="Ex. BYNHH23T"
              className="input-field mt-1.5 uppercase placeholder:normal-case"
              value={form.codeParrain}
              onChange={(e) => setForm((f) => ({ ...f, codeParrain: e.target.value.toUpperCase() }))}
            />
            <FieldError errors={fieldErrors} name="code_parrain" />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => goTo('login')}>
            J'ai déjà un compte
          </button>
        </form>
      )}

      {mode === 'verify' && (
        <form onSubmit={handleVerify} className="space-y-3">
          <p className="text-sm text-surface-500">
            Code à 6 chiffres envoyé à{' '}
            <span className="font-medium text-surface-900">{verifyEmailAddress}</span>{' '}
            (valable 30 minutes).
          </p>
          <label className="block text-sm font-medium text-surface-700">
            Code de vérification
            <input
              type="text" inputMode="numeric" maxLength={6} pattern="[0-9]*"
              placeholder="123456"
              className="input-field mt-1.5 text-center text-lg tracking-[0.3em]"
              value={form.code} onChange={set('code')} autoFocus required
            />
            <FieldError errors={fieldErrors} name="code" />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Vérification…' : 'Valider'}
          </button>
          <div className="flex items-center justify-between pt-1 text-sm">
            <button type="button" className="font-medium text-primary-600" onClick={handleResend} disabled={loading}>
              Renvoyer le code
            </button>
            <button type="button" className="text-surface-500" onClick={() => goTo('register')}>
              Modifier l'adresse
            </button>
          </div>
        </form>
      )}

      {mode === 'forgot' && (
        <form onSubmit={handleForgot} className="space-y-3">
          <label className="block text-sm font-medium text-surface-700">
            Email du compte
            <input
              type="email" inputMode="email" autoComplete="email"
              className="input-field mt-1.5" value={form.email} onChange={set('email')} autoFocus required
            />
            <FieldError errors={fieldErrors} name="email" />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Envoi…' : 'Recevoir un code'}
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => goTo('login')}>
            Retour à la connexion
          </button>
        </form>
      )}

      {mode === 'reset' && (
        <form onSubmit={handleReset} className="space-y-3">
          <p className="text-sm text-surface-500">
            Code envoyé à{' '}
            <span className="font-medium text-surface-900">{verifyEmailAddress}</span>{' '}
            (valable 15 minutes).
          </p>
          <label className="block text-sm font-medium text-surface-700">
            Code de réinitialisation
            <input
              type="text" inputMode="numeric" maxLength={6} pattern="[0-9]*"
              placeholder="123456"
              className="input-field mt-1.5 text-center text-lg tracking-[0.3em]"
              value={form.code} onChange={set('code')} autoFocus required
            />
            <FieldError errors={fieldErrors} name="code" />
          </label>
          <label className="block text-sm font-medium text-surface-700">
            Nouveau mot de passe
            <input
              type="password" autoComplete="new-password" minLength={8}
              className="input-field mt-1.5" value={form.password} onChange={set('password')} required
            />
            <FieldError errors={fieldErrors} name="password" />
          </label>
          <label className="block text-sm font-medium text-surface-700">
            Confirmer le mot de passe
            <input
              type="password" autoComplete="new-password" minLength={8}
              className="input-field mt-1.5" value={form.passwordConfirmation} onChange={set('passwordConfirmation')} required
            />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Réinitialisation…' : 'Réinitialiser'}
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => goTo('login')}>
            Retour à la connexion
          </button>
        </form>
      )}
    </BottomSheet>

      <CountrySelectSheet
        open={countrySheetOpen}
        onClose={() => setCountrySheetOpen(false)}
        currentCode={form.codePays}
        onSelect={(code) => setForm((f) => ({ ...f, codePays: code }))}
        title="Votre pays"
        description="Le pays du compte détermine votre agence de rattachement et votre tarification."
      />
    </>
  );
}
