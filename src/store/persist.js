// Petite persistance localStorage pour l'etat purement local (panier, favoris,
// vus recemment). Tolere un stockage indisponible (navigation privee).
export const loadJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const saveJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : l'etat vit jusqu'au rechargement */
  }
};
