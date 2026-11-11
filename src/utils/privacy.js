// Nettoyage des données personnelles gardées sur l'appareil (appareil partagé).

const LOCAL_KEYS = [
  'tourshop:sell-draft',
  'marketplace_adresse_livraison',
  'marketplace_search_history',
  'marketplace_contexte_livraison',
];

// Réponses d'API mises en cache par le service worker (24 h).
export const clearApiCache = async () => {
  try {
    if (typeof caches !== 'undefined') await caches.delete('api-cache');
  } catch {
    // non bloquant
  }
};

// Déconnexion volontaire : brouillons, adresses mémorisées et cache d'API.
export const purgePrivateData = async () => {
  LOCAL_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // non bloquant
    }
  });
  try {
    if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase('tourshop-drafts');
  } catch {
    // non bloquant
  }
  await clearApiCache();
};
