import api from './api';
import authService from './authService';

// Profile management — docs/api-profil-et-notifications-client.md.
// Every route here needs `Authorization: Bearer <token>` (added by the api
// interceptor). These live only under `/api/profile/*`; `GET /api/profil`
// (authService.fetchProfile) is the read-only, historical alias.

// GET /api/profile/ — same payload as GET /api/profil. Refreshes the cached user.
const get = async () => {
  const { data } = await api.get('/profile/');
  authService.persistUser(data?.user);
  return data;
};

// PUT /api/profile/update — all fields are `sometimes`; only send what changed.
// - `codePays`: client accounts only (422 "code pays field is prohibited." for
//   agence/livreur/backoffice). Same ValidCountryCode rule as register,
//   case-insensitive ("fr" -> "FR"). Effective immediately (no re-verification).
// - `email` changed to a NEW address -> `email_verified_at` back to null and a
//   6-digit code sent to the NEW address; the current token stays valid but a
//   later `login` is blocked until POST /api/verify-email is re-run with it.
//   The success message mentions the code only when the email actually changed.
const update = async ({ nom, prenoms, telephone, email, codePays }) => {
  const payload = {};
  if (nom !== undefined) payload.nom = nom;
  if (prenoms !== undefined) payload.prenoms = prenoms;
  if (telephone !== undefined) payload.telephone = telephone;
  if (email !== undefined) payload.email = email;
  if (codePays !== undefined) payload.code_pays = codePays;
  const { data } = await api.put('/profile/update', payload);
  if (data?.user) authService.persistUser(data.user);
  return data;
};

// PUT /api/profile/change-password — verifies `current_password` first, then
// changes it AND revokes every token of the account (forced logout, like
// reset-password). Re-login required afterwards with the new password.
const changePassword = async ({ currentPassword, password, passwordConfirmation }) => {
  const { data } = await api.put('/profile/change-password', {
    current_password: currentPassword,
    password,
    password_confirmation: passwordConfirmation,
  });
  authService.clearSession();
  return data;
};

// PUT /api/profile/favorite-addresses — REPLACES the whole list; always send the
// full desired array (`[]` clears it). Stored as raw JSON, no geo validation,
// no link to tariff zones — a plain address book to prefill expedition forms.
// Each entry: { nom*, adresse*, ville?, code_postal?, pays? }.
const updateFavoriteAddresses = async (adressesFavoris) => {
  const { data } = await api.put('/profile/favorite-addresses', {
    adresses_favoris: adressesFavoris,
  });
  return data;
};

// PUT /api/profile/avatar — NOT a file upload. `avatar` is a plain string (URL)
// stored as-is (no URL validation, no image processing). The app must host the
// image elsewhere and send only the resulting URL here.
const updateAvatar = async (avatar) => {
  const { data } = await api.put('/profile/avatar', { avatar });
  return data;
};

// DELETE /api/profile/delete-account — soft delete (is_deleted = true AND
// actif = false), revokes all tokens. `password` is verified first. A protected
// account (agency/backoffice creator) is blocked with 422 — never a normal
// client. Afterwards `login` answers "Votre compte est désactivé.".
const deleteAccount = async (password) => {
  const { data } = await api.delete('/profile/delete-account', { data: { password } });
  authService.clearSession();
  return data;
};

const profileService = {
  get,
  update,
  changePassword,
  updateFavoriteAddresses,
  updateAvatar,
  deleteAccount,
};

export default profileService;
