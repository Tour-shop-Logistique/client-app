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

// Poids saisi au-dessus du maximum du format choisi.
export const overweight = (colis, format) =>
  Boolean(format) && format.poids_max != null && Number(colis.poids) > Number(format.poids_max);
