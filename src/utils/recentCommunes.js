// Dernières communes de destination choisies, par pays (3 au plus), pour les
// proposer en raccourci sur l'étape Trajet. Stockage local best-effort : en
// navigation privée ou stockage bloqué, la liste reste simplement vide.

const MAX = 3;
const key = (codePays) => `tourshop:recent-communes:${codePays}`;

export function getRecentCommunes(codePays) {
  if (!codePays) return [];
  try {
    const value = JSON.parse(localStorage.getItem(key(codePays)) || '[]');
    return Array.isArray(value) ? value.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecentCommune(codePays, communeId) {
  const next = [communeId, ...getRecentCommunes(codePays).filter((id) => id !== communeId)].slice(0, MAX);
  try {
    localStorage.setItem(key(codePays), JSON.stringify(next));
  } catch {
    // stockage indisponible : on garde la liste en mémoire seulement
  }
  return next;
}
