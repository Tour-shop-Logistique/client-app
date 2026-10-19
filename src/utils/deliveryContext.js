// Contexte de livraison d'une commande marketplace, memorise a la validation
// du panier (MARKETPLACE_LIVRAISON_3_MODES.md) :
//   { communeDepartId, communeLivraisonId, from: {lat, lng}, to: {lat, lng} }
// La commande renvoyee par l'API ne porte ni la commune de l'annonce ni la
// position de retrait tant que le mode n'est pas choisi ; sans ce contexte,
// l'ecran de commande ne pourrait pas reafficher les 3 tarifs.

const KEY = 'marketplace_contexte_livraison';
const MAX = 50;

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
};

const write = (all) => {
  try {
    // On ne garde que les plus recents.
    const entries = Object.entries(all).sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0)).slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // stockage indisponible : non bloquant
  }
};

export const saveDeliveryContext = (commandeId, ctx) => {
  if (!commandeId) return;
  const all = read();
  all[commandeId] = { ...ctx, at: Date.now() };
  write(all);
};

export const loadDeliveryContext = (commandeId) => (commandeId ? read()[commandeId] ?? null : null);

const point = (lat, lng) => (lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null);

// Contexte d'une commande : memorise, complete par ce que porte la commande
// (adresse de livraison saisie au panier, retrait si deja copie).
export const deliveryContextOf = (commande) => {
  const saved = loadDeliveryContext(commande?.id) ?? {};
  return {
    communeDepartId: saved.communeDepartId ?? commande?.commune_depart_id ?? null,
    communeLivraisonId: commande?.commune_livraison_id ?? saved.communeLivraisonId ?? null,
    from: point(commande?.retrait_latitude, commande?.retrait_longitude) ?? saved.from ?? null,
    to: point(commande?.livraison_latitude, commande?.livraison_longitude) ?? saved.to ?? null,
  };
};
