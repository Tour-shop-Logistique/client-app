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

const E164 = /^\+[1-9]\d{6,14}$/;
const cleanWhatsapp = (v) => (v || '').replace(/[\s.\-()]/g, '');

// WhatsApp saisi mais pas au format E.164 (+2250102030405) : 422 côté API.
export const whatsappInvalid = (data) => {
  const v = cleanWhatsapp(data?.whatsapp);
  return Boolean(v) && !E164.test(v);
};

export function contactIsComplete(data) {
  return Boolean(
    data.nom_prenom.trim() && data.telephone.trim() && data.adresse.trim() && data.ville.trim()
  ) && !whatsappInvalid(data);
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
    [`${prefix}_telephone`]: data.telephone.trim(),
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
