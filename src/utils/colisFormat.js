// Formats de colis du backoffice (GET /api/expedition/client/formats-colis) :
// { id, nom, poids_max, longueur_max, largeur_max, hauteur_max, volume_max, is_default }.
// Un max `null` = illimité (ex. « Grand ») : le client saisit alors ses dimensions.

export const defaultFormat = (formats = []) => formats.find((f) => f.is_default) || formats[0] || null;

// Le format porte des dimensions fixes : elles sont remplies automatiquement.
export const formatHasDims = (f) => Boolean(f) && [f.longueur_max, f.largeur_max, f.hauteur_max].every((v) => Number(v) > 0);

export const formatDims = (f) => (formatHasDims(f) ? `${f.longueur_max} × ${f.largeur_max} × ${f.hauteur_max} cm` : null);

export const formatHint = (f) => (f.poids_max != null ? `jusqu'à ${f.poids_max} kg` : 'poids libre');

// Applique un format au colis : id + dimensions du format. Format sans
// dimensions : on vide celles héritées d'un format précédent (saisie libre).
export const applyFormat = (colis, format) => {
  if (!format) return colis;
  const prev = colis.format_colis_id && colis._formatDims;
  if (formatHasDims(format)) {
    return {
      ...colis,
      format_colis_id: format.id,
      longueur: String(format.longueur_max),
      largeur: String(format.largeur_max),
      hauteur: String(format.hauteur_max),
      _formatDims: true,
    };
  }
  return {
    ...colis,
    format_colis_id: format.id,
    ...(prev ? { longueur: '', largeur: '', hauteur: '' } : {}),
    _formatDims: false,
  };
};

// Aligne chaque colis sur la liste de formats de l'API : un colis sans format
// (créé avant l'arrivée des formats, restauré d'un brouillon, format d'un autre
// pays) reçoit le format par défaut ; un colis dont le format porte des
// dimensions fixes reprend ces dimensions. Renvoie la MÊME liste si rien ne
// change (pas de rendu en boucle quand on l'appelle dans un effet).
export const syncColisFormats = (list, formats = []) => {
  const def = defaultFormat(formats);
  if (!def) return list;
  let changed = false;
  const next = list.map((c) => {
    const current = formats.find((f) => f.id === c.format_colis_id);
    if (!current) {
      changed = true;
      return applyFormat({ ...c, format_colis_id: '' }, def);
    }
    const stale = formatHasDims(current) && (
      String(current.longueur_max) !== String(c.longueur)
      || String(current.largeur_max) !== String(c.largeur)
      || String(current.hauteur_max) !== String(c.hauteur)
    );
    if (stale) {
      changed = true;
      return applyFormat(c, current);
    }
    return c;
  });
  return changed ? next : list;
};

// Poids saisi au-dessus du maximum du format choisi.
export const overweight = (colis, format) =>
  Boolean(format) && format.poids_max != null && Number(colis.poids) > Number(format.poids_max);
