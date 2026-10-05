// Affichage du client connecté (le profil API renvoie `nom` + `prenoms`,
// certains anciens comptes seulement `name`).

export const fullUserName = (user) =>
  [user?.prenoms, user?.nom].filter(Boolean).join(' ') || user?.name || 'Client TourShop';

export const firstName = (user) => user?.prenoms?.split(' ')[0] || user?.name?.split(' ')[0] || user?.nom || null;

export const userInitials = (user) =>
  [user?.prenoms || user?.name, user?.nom]
    .filter(Boolean)
    .map((s) => s.trim()[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
