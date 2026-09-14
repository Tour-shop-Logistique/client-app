// Shared shape + helpers for the expediteur/destinataire blocks of the
// expedition forms. store (all modes) requires nom_prenom, telephone, adresse,
// ville; the rest is optional (api-enregistrement-expedition-client.md).

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
};

export function contactIsComplete(data) {
  return Boolean(
    data.nom_prenom.trim() && data.telephone.trim() && data.adresse.trim() && data.ville.trim()
  );
}

// Prefixes the fields (`expediteur_*` / `destinataire_*`), trims, and turns ""
// into null so optional fields aren't sent as empty strings.
export function contactPayload(prefix, data) {
  const orNull = (v) => {
    const t = (v || '').trim();
    return t || null;
  };
  return {
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
}
