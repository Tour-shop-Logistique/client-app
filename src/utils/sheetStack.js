// Pile des feuilles (BottomSheet) ouvertes, de la plus ancienne à la plus récente.
// Permet au bouton retour de fermer d'abord la feuille du dessus, quel que soit
// le composant qui l'a ouverte (voir useExitGuard).

const stack = [];

export function registerSheet(close) {
  const entry = { close };
  stack.push(entry);
  return () => {
    const i = stack.indexOf(entry);
    if (i !== -1) stack.splice(i, 1);
  };
}

// Ferme la feuille du dessus ; false s'il n'y en avait aucune.
export function closeTopSheet() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}
