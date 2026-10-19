// Devise dynamique (user-parcour/CHANGEMENTS_APPS_CLIENT_LIVREUR.md §1) :
// `user.devise` (code ISO 4217) vient du backoffice du pays de l'utilisateur —
// plus de XOF / FCFA code en dur. La devise par defaut est synchronisee depuis
// le store (cf. store/index.js). Pour un montant d'EXPEDITION, utiliser
// `expedition.devise_origine` (devise du pays de depart), pas `user.devise` :
// voir `expeditionCurrency()`.
const FALLBACK_CURRENCY = 'XOF';
let defaultCurrency = FALLBACK_CURRENCY;

export const setDefaultCurrency = (code) => {
  defaultCurrency = (typeof code === 'string' && code.trim()) ? code.trim().toUpperCase() : FALLBACK_CURRENCY;
};

export const getDefaultCurrency = () => defaultCurrency;

// Francs CFA (UEMOA / CEMAC) : affiches "FCFA".
const CFA = new Set(['XOF', 'XAF']);
const isIsoCode = (c) => typeof c === 'string' && /^[A-Z]{3}$/.test(c);

// Libelle court d'une devise : 'FCFA', '€', '$', 'GNF'…
export const currencyLabel = (code = defaultCurrency) => {
  const c = String(code || defaultCurrency).toUpperCase();
  if (CFA.has(c)) return 'FCFA';
  try {
    const part = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value || c;
  } catch {
    return c; // code inconnu d'Intl : affiche tel quel
  }
};

const maxDecimals = (code) => {
  if (!isIsoCode(code) || CFA.has(code)) return 0;
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 0;
  }
};

// `currency` : code ISO (EUR, XAF…), libelle deja pret ('FCFA') ou '' pour le
// nombre seul. Absent : devise de l'utilisateur connecte.
export const formatPrice = (value, currency) => {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  if (Number.isNaN(n)) return '-';
  const raw = currency === undefined ? defaultCurrency : currency;
  const code = typeof raw === 'string' ? raw.trim() : raw;
  const digits = Number.isInteger(n) ? 0 : maxDecimals(code);
  const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(n);
  if (!code) return number;
  return `${number} ${isIsoCode(code) ? currencyLabel(code) : code}`;
};

// Devise d'une expedition : celle de son pays de depart (`devise_origine`),
// qui peut differer de celle de l'utilisateur qui la consulte.
export const expeditionCurrency = (expedition) => expedition?.devise_origine || defaultCurrency;

// Montant d'expedition dans sa devise d'origine.
export const formatExpeditionPrice = (value, expedition) => formatPrice(value, expeditionCurrency(expedition));

export const formatDate = (value, options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('fr-FR', options).format(new Date(value));
};

export const formatDateTime = (value) =>
  formatDate(value, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
