import api from './api';

// Parrainage client — docs/api-parrainage-client.md.
// Every route needs `Authorization: Bearer <token>` AND a `client` account
// (403 "Non autorisé" for agence/livreur/backoffice tokens).
// Read-only scope: no "apply a code" endpoint (that happens at register via
// `code_parrain`, see authService.register) and no balance withdrawal yet.
//
// A bonus is credited server-side, automatically, only when a filleul completes
// a PAID activity (international/national shipping, pickup/delivery) — never at
// signup. `solde` / `historique` just update on their own afterwards; poll on
// pull-to-refresh, there is no push event for a new bonus.

// GET /api/client/parrainage/mon-code -> { success, code_parrainage }
// Redundant with `user.code_parrainage` (present on register/login/profil).
const getMyCode = async () => {
  const { data } = await api.get('/client/parrainage/mon-code');
  return data;
};

// GET /api/client/parrainage/solde -> { success, solde_parrainage }
// FCFA (backoffice currency of the client's country), `0` not `null` when empty.
const getBalance = async () => {
  const { data } = await api.get('/client/parrainage/solde');
  return data;
};

// GET /api/client/parrainage/historique?page=N -> { success, historique: <paginator> }
// `historique` is the RAW Laravel ->paginate() shape:
// { current_page, data: [...], last_page, per_page, total, first_page_url, ... }
// 20 per page, newest first. Empty history is still 200 with `data: []`.
const getHistory = async (page = 1) => {
  const { data } = await api.get('/client/parrainage/historique', { params: { page } });
  return data;
};

// GET /api/client/parrainage/filleuls -> { success, filleuls: [{ id, nom, prenoms, created_at }] }
// Not paginated. A filleul appears from signup, even with no paid activity yet
// (this list reflects the parrain link only, not credited bonuses).
const getReferees = async () => {
  const { data } = await api.get('/client/parrainage/filleuls');
  return data;
};

const referralService = { getMyCode, getBalance, getHistory, getReferees };

export default referralService;
