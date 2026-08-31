import axios from 'axios';

// VITE_API_URL est injecté au build (variable `VITE_`). On enlève un éventuel
// slash final pour composer proprement `${API_URL}/api`.
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

// - Dev  : baseURL relatif `/api` -> réécrit par le proxy Vite (vite.config.js)
//          vers VITE_API_URL. Même origine côté navigateur, aucun CORS.
// - Prod : pas de proxy -> on appelle directement le domaine de l'API. Requiert
//          que le backend autorise le CORS pour l'origine de l'app (config/cors.php).
// Si VITE_API_URL n'est pas défini, on retombe sur `/api` relatif dans tous les cas.
const baseURL = import.meta.env.PROD && API_URL ? `${API_URL}/api` : '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 means the Sanctum token is gone or was revoked (e.g. after
    // reset-password revokes every token). Drop the local session and let the
    // store react so the UI falls back to guest mode.
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
