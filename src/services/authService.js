import api from './api';

// Email-based auth per docs/api-authentification-client.md.
// Mandatory flow for a new client: register -> verify-email -> login.
// Only `login` ever returns a token (Sanctum, sent as `Authorization: Bearer <token>`).
// `type: "client"` must be sent explicitly on every register/login call.

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

const persistUser = (user) => {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const persistSession = ({ user, token }) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  persistUser(user);
};

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// POST /api/register — creates the account with email_verified_at = null and
// emails a 6-digit code (valid 30 min). Never returns a token.
const register = async ({ nom, prenoms, telephone, email, password, passwordConfirmation }) => {
  const { data } = await api.post('/register', {
    nom,
    prenoms: prenoms || undefined,
    telephone,
    email,
    password,
    password_confirmation: passwordConfirmation,
    type: 'client',
  });
  return data;
};

// POST /api/verify-email — validates the 6-char code, sets email_verified_at.
// This is the step that unlocks `login`. No token returned.
const verifyEmail = async ({ email, code }) => {
  const { data } = await api.post('/verify-email', { email, code });
  return data;
};

// POST /api/resend-email-verification — always `success: true` on the happy path
// (generic message to avoid account enumeration).
const resendEmailVerification = async (email) => {
  const { data } = await api.post('/resend-email-verification', { email });
  return data;
};

// POST /api/login — the only endpoint that delivers a token. Accepts `email` OR
// `telephone` plus `password`; `type: "client"` acts as an account filter.
const login = async ({ email, telephone, password }) => {
  const payload = { password, type: 'client' };
  if (email) payload.email = email;
  if (telephone) payload.telephone = telephone;
  const { data } = await api.post('/login', payload);
  if (data?.token) persistSession({ user: data.user, token: data.token });
  return data;
};

// POST /api/logout — revokes only the token used for this call.
const logout = async () => {
  try {
    await api.post('/logout');
  } finally {
    clearSession();
  }
};

// GET /api/profil — restores a session from a stored token at app boot.
const fetchProfile = async () => {
  const { data } = await api.get('/profil');
  persistUser(data?.user);
  return data;
};

// POST /api/forgot-password — emails a 6-digit code (valid 15 min).
// WARNING: an unknown email answers HTTP 200 with `success: false` (not 404),
// so callers must read the `success` flag, not just the HTTP status.
const forgotPassword = async (email) => {
  const { data } = await api.post('/forgot-password', { email });
  return data;
};

// POST /api/verify-reset-code — checks the code without consuming it.
const verifyResetCode = async ({ email, code }) => {
  const { data } = await api.post('/verify-reset-code', { email, code });
  return data;
};

// POST /api/reset-password — changes the password AND revokes every existing
// token for the account. Any stored token is dead afterwards -> full re-login.
const resetPassword = async ({ email, code, password, passwordConfirmation }) => {
  const { data } = await api.post('/reset-password', {
    email,
    code,
    password,
    password_confirmation: passwordConfirmation,
  });
  clearSession();
  return data;
};

const getStoredUser = () => {
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getStoredToken = () => localStorage.getItem(TOKEN_KEY);

const authService = {
  register,
  verifyEmail,
  resendEmailVerification,
  login,
  logout,
  fetchProfile,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  getStoredUser,
  getStoredToken,
  clearSession,
};

export default authService;
