// Shared shape + helpers for the expediteur/destinataire blocks of the
// expedition forms. store (all modes) requires nom_prenom, telephone, adresse,
// ville; the rest is optional (api-enregistrement-expedition-client.md).
// Optional extras per block: `{prefix}_whatsapp_number` (E.164, notifications
// duplicated on WhatsApp) and `{prefix}_latitude` / `_longitude` /
// `_instructions` (GPS navigation + notes for the courier).

export const EMPTY_CONTACT = {
  nom_prenom: '',
  telephone: '',
  email: '',
  adresse: '',
  ville: '',
  societe: '',
  code_postal: '',
  etat: '',
  quartier: '',
  whatsapp: '',
  latitude: null,
  longitude: null,
  instructions: '',
};

import { digitsOnly } from './digits';

const E164 = /^\+[1-9]\d{6,14}$/;
// Saisi en chiffres (indicatif + numéro) ; le « + » E.164 est ajouté ici.
// Un ancien brouillon (« +225 01-02… ») est nettoyé de la même façon.
const cleanWhatsapp = (v) => {
  const digits = digitsOnly(v);
  return digits ? `+${digits}` : '';
};

// WhatsApp saisi mais pas au format E.164 (+2250102030405) : 422 côté API.
export const whatsappInvalid = (data) => {
  const v = cleanWhatsapp(data?.whatsapp);
  return Boolean(v) && !E164.test(v);
};

// E-mail saisi mais invalide (l'API le refuse en 422). Vide = valide (optionnel).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const emailInvalid = (data) => {
  const v = (data?.email || '').trim();
  return Boolean(v) && !EMAIL.test(v);
};

// Champs obligatoires non remplis (ou invalides), dans l'ordre d'affichage.
export function contactMissing(data) {
  const missing = [];
  if (!data.nom_prenom.trim()) missing.push('nom_prenom');
  if (!digitsOnly(data.telephone)) missing.push('telephone');
  if (!data.adresse.trim()) missing.push('adresse');
  if (!data.ville.trim()) missing.push('ville');
  if (emailInvalid(data)) missing.push('email');
  if (whatsappInvalid(data)) missing.push('whatsapp');
  return missing;
}

export function contactIsComplete(data) {
  return contactMissing(data).length === 0;
}

// Fait defiler jusqu'au premier champ en erreur (marque `data-invalid`) et lui
// donne le focus. A appeler juste apres avoir active l'affichage des erreurs.
export function focusFirstInvalid() {
  setTimeout(() => {
    const el = document.querySelector('[data-invalid="true"]');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof el.focus === 'function') el.focus({ preventScroll: true });
  }, 120);
}

// Prefixes the fields (`expediteur_*` / `destinataire_*`), trims, and turns ""
// into null so optional fields aren't sent as empty strings. Position and
// instructions are only sent when filled.
export function contactPayload(prefix, data) {
  const orNull = (v) => {
    const t = (v || '').trim();
    return t || null;
  };
  const out = {
    [`${prefix}_nom_prenom`]: data.nom_prenom.trim(),
    [`${prefix}_telephone`]: digitsOnly(data.telephone),
    [`${prefix}_email`]: orNull(data.email),
    [`${prefix}_adresse`]: data.adresse.trim(),
    [`${prefix}_ville`]: data.ville.trim(),
    [`${prefix}_societe`]: orNull(data.societe),
    [`${prefix}_code_postal`]: orNull(data.code_postal),
    [`${prefix}_etat`]: orNull(data.etat),
    [`${prefix}_quartier`]: orNull(data.quartier),
  };
  const whatsapp = cleanWhatsapp(data.whatsapp);
  if (whatsapp) out[`${prefix}_whatsapp_number`] = whatsapp;
  if (data.latitude != null && data.longitude != null) {
    out[`${prefix}_latitude`] = data.latitude;
    out[`${prefix}_longitude`] = data.longitude;
  }
  const instructions = (data.instructions || '').trim();
  if (instructions) out[`${prefix}_instructions`] = instructions;
  return out;
}

// Adresse du profil a proposer par defaut : « Domicile » / « Maison » si elle
// existe, sinon la premiere adresse favorite renseignee.
const defaultFavorite = (user) => {
  const list = Array.isArray(user?.adresses_favoris) ? user.adresses_favoris.filter((f) => f?.adresse) : [];
  return list.find((f) => /domicile|maison|home/i.test(f.nom || '')) || list[0] || null;
};

// Coordonnees de l'expediteur deduites du profil du client connecte : nom,
// telephone, e-mail, WhatsApp et adresse (favorite par defaut). Champs vides si
// le profil ne les a pas.
export function expediteurFromProfile(user) {
  if (!user) return {};
  const fav = defaultFavorite(user);
  return {
    nom_prenom: [user.nom, user.prenoms].filter(Boolean).join(' '),
    telephone: digitsOnly(user.telephone),
    email: user.email || '',
    whatsapp: digitsOnly(user.whatsapp_number || user.whatsapp),
    adresse: fav?.adresse || '',
    ville: fav?.ville || '',
    code_postal: fav?.code_postal || '',
  };
}

// Complete uniquement les champs encore vides : ce que le client a deja saisi
// (ou restaure depuis un brouillon) n'est jamais ecrase.
export function fillEmptyFields(contact, values) {
  const next = { ...contact };
  let changed = false;
  Object.entries(values).forEach(([key, value]) => {
    const current = next[key];
    if (value && (current == null || String(current).trim() === '')) {
      next[key] = value;
      changed = true;
    }
  });
  return changed ? next : contact;
}

// Adresse favorite du profil (PUT /profile/favorite-addresses :
// { nom, adresse, ville?, code_postal?, pays? }) -> champs du bloc contact.
// `nom` est le libellé ("Domicile"), pas le nom de la personne : non recopié.
export function applyFavorite(data, favorite, { keepVille = false } = {}) {
  return {
    ...data,
    adresse: favorite?.adresse || data.adresse,
    ville: keepVille ? data.ville : favorite?.ville || data.ville,
    code_postal: favorite?.code_postal || data.code_postal,
  };
}

// Pièce d'identité de l'expéditeur (store, tous modes) :
// `expediteur_numero_piece_identite`, `expediteur_date_expiration_piece_identite` (AAAA-MM-JJ).
export const EMPTY_IDENTITY = { numero_piece_identite: '', date_expiration_piece_identite: '' };

const today = () => new Date().toISOString().slice(0, 10);

// Pièce déjà expirée : date saisie antérieure à aujourd'hui.
export const identityExpired = (data) =>
  Boolean(data?.date_expiration_piece_identite) && data.date_expiration_piece_identite < today();

export function identityPayload(data) {
  const numero = (data?.numero_piece_identite || '').trim();
  const date = data?.date_expiration_piece_identite || '';
  return {
    expediteur_numero_piece_identite: numero || null,
    expediteur_date_expiration_piece_identite: date || null,
  };
}
