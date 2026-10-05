import api from './api';

// Marketplace (vente entre clients) — voir MARKETPLACE_ET_ABONNEMENT_API.md.
// Toutes les routes exigent un token Sanctum. Les routes `/marketplace/vendeur/*`
// sont derriere le middleware d'abonnement : 403 `code: "ABONNEMENT_BLOQUE"` si le
// vendeur est en retard de paiement (intercepte dans api.js).

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

// Construit un FormData en ignorant les valeurs vides ; `files` est ajoute en
// `champ[]` (photos) ou en champ simple (preuve).
const toFormData = (fields, files = {}) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') fd.append(key, value);
  });
  Object.entries(files).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((file) => fd.append(`${key}[]`, file));
    else if (value) fd.append(key, value);
  });
  return fd;
};

// --- Acheteur (section 4) — jamais bloque par l'abonnement ------------------

// GET /marketplace/acheteur/catalogue/list — pagination Laravel standard.
// Params : code_pays, recherche, per_page, page.
const catalogue = async (params = {}) => {
  const { data } = await api.get('/marketplace/acheteur/catalogue/list', { params });
  return data.annonces;
};

// GET /marketplace/acheteur/catalogue/show/{id} -> { annonce, est_ma_propre_annonce }
const catalogueShow = async (id) => {
  const { data } = await api.get(`/marketplace/acheteur/catalogue/show/${id}`);
  return data;
};

// Moyens de paiement ACTIFS d'un vendeur, a proposer avant de declarer un paiement.
const vendeurMoyensPaiement = async (vendeurId) => {
  const { data } = await api.get(`/marketplace/acheteur/vendeurs/${vendeurId}/moyens-paiement`);
  return data.moyens_paiement ?? [];
};

// POST /marketplace/acheteur/panier/valider — scinde en une commande par vendeur.
// `adresseLivraison` REQUISE : { nom, telephone, adresse, ville, quartier?,
// latitude?, longitude?, instructions? } — une seule adresse pour tout le panier.
const validerPanier = async (annonceIds, adresseLivraison) => {
  const { data } = await api.post('/marketplace/acheteur/panier/valider', {
    annonce_ids: annonceIds,
    adresse_livraison: adresseLivraison,
  });
  return data.commandes ?? [];
};

// Declaratif : passe la commande en `paiement_a_confirmer`, le vendeur confirme ensuite.
const declarerPaiementCommande = async (commandeId, { paymentMethod, reference, preuve }) => {
  const fd = toFormData({ payment_method: paymentMethod, reference }, { preuve });
  const { data } = await api.post(`/marketplace/acheteur/commandes/${commandeId}/declarer-paiement`, fd, multipart);
  return data.commande;
};

const mesAchats = async () => {
  const { data } = await api.get('/marketplace/acheteur/commandes/list');
  return data.commandes ?? [];
};

// Accessible au vendeur OU a l'acheteur de la commande ; inclut livraison_marketplace.offres.
const commandeShow = async (id) => {
  const { data } = await api.get(`/marketplace/acheteur/commandes/show/${id}`);
  return data.commande;
};

// --- Vendeur : annonces (section 2) -----------------------------------------

const mesAnnonces = async () => {
  const { data } = await api.get('/marketplace/vendeur/annonces/list');
  return data.annonces ?? [];
};

const annonceShow = async (id) => {
  const { data } = await api.get(`/marketplace/vendeur/annonces/show/${id}`);
  return data.annonce;
};

// Cree en `brouillon`. `retrait` = champs `retrait_*` (adresse de retrait, section 2,
// copiee sur la commande quand le vendeur choisit une livraison par livreur).
// Les photos ne s'ajoutent QU'A la creation (max 10, 5 Mo).
const creerAnnonce = async ({ titre, description, prix, photos = [], retrait = {} }) => {
  const fd = toFormData({ titre, description, prix, ...retrait }, { photos });
  const { data } = await api.post('/marketplace/vendeur/annonces/store', fd, multipart);
  return data.annonce;
};

const modifierAnnonce = async (id, fields) => {
  const { data } = await api.put(`/marketplace/vendeur/annonces/update/${id}`, fields);
  return data.annonce;
};

// La 1re publication demarre l'abonnement vendeur (effet de bord serveur).
const publierAnnonce = async (id) => {
  const { data } = await api.post(`/marketplace/vendeur/annonces/${id}/publier`);
  return data.annonce;
};

const depublierAnnonce = async (id) => {
  const { data } = await api.post(`/marketplace/vendeur/annonces/${id}/depublier`);
  return data.annonce;
};

const supprimerPhoto = async (annonceId, photoId) => {
  const { data } = await api.delete(`/marketplace/vendeur/annonces/${annonceId}/photos/${photoId}`);
  return data;
};

// --- Vendeur : moyens de paiement (section 3) --------------------------------

const mesMoyensPaiement = async () => {
  const { data } = await api.get('/marketplace/vendeur/moyens-paiement/list');
  return data.moyens_paiement ?? [];
};

const ajouterMoyenPaiement = async ({ methode, numeroDestinataire, libelle, actif = true }) => {
  const { data } = await api.post('/marketplace/vendeur/moyens-paiement/store', {
    methode,
    numero_destinataire: numeroDestinataire || null,
    libelle: libelle || null,
    actif,
  });
  return data.moyen_paiement;
};

// Champs en `sometimes` : n'envoyer que ce qui change (ex. { actif: false }).
const modifierMoyenPaiement = async (id, fields) => {
  const { data } = await api.put(`/marketplace/vendeur/moyens-paiement/update/${id}`, fields);
  return data.moyen_paiement;
};

const supprimerMoyenPaiement = async (id) => {
  const { data } = await api.delete(`/marketplace/vendeur/moyens-paiement/${id}`);
  return data;
};

// --- Vendeur : ventes, paiement, livraison (sections 5 et 6) -----------------

const mesVentes = async () => {
  const { data } = await api.get('/marketplace/vendeur/ventes/list');
  return data.commandes ?? [];
};

const venteShow = async (id) => {
  const { data } = await api.get(`/marketplace/vendeur/ventes/show/${id}`);
  return data.commande;
};

const confirmerPaiement = async (id) => {
  const { data } = await api.post(`/marketplace/vendeur/ventes/${id}/paiement/confirmer`);
  return data.commande;
};

const infirmerPaiement = async (id) => {
  const { data } = await api.post(`/marketplace/vendeur/ventes/${id}/paiement/infirmer`);
  return data.commande;
};

const livraisonReseau = async (id) => {
  const { data } = await api.post(`/marketplace/vendeur/ventes/${id}/livraison/reseau`);
  return data.livraison;
};

// La livraison passe `proposee` : le livreur a 15 min pour accepter. S'il refuse
// ou ne repond pas, la commande revient `payee` et le vendeur re-choisit.
const livraisonDirect = async (id, { livreurId, montant }) => {
  const { data } = await api.post(`/marketplace/vendeur/ventes/${id}/livraison/direct`, {
    livreur_id: livreurId,
    montant,
  });
  return data.livraison;
};

const livraisonHorsPlateforme = async (id) => {
  const { data } = await api.post(`/marketplace/vendeur/ventes/${id}/livraison/hors-plateforme`);
  return data.commande;
};

// Uniquement en mode hors plateforme.
const marquerLivree = async (id) => {
  const { data } = await api.post(`/marketplace/vendeur/ventes/${id}/livraison/marquer-livree`);
  return data.commande;
};

// GET /marketplace/vendeur/livreurs/recherche?telephone= — numero exact, livreur
// valide KYC du meme pays -> { id, nom, prenoms, type_vehicule, ville, disponible }.
// 404 sinon (sans dire si le numero existe). `id` = `livreur_id` de livraison/direct.
const rechercherLivreur = async (telephone) => {
  const { data } = await api.get('/marketplace/vendeur/livreurs/recherche', { params: { telephone } });
  return data.livreur;
};

// Annulation d'une commande pas encore payee (acheteur ou vendeur), `motif`
// optionnel. Diffuse CommandeMarketplace/annulee aux deux parties. Sans
// declaration de paiement, la commande expire seule apres 48 h.
const annulerCommande = async (id, motif) => {
  const { data } = await api.post(`/marketplace/acheteur/commandes/${id}/annuler`, { motif: motif || undefined });
  return data;
};

const annulerVente = async (id, motif) => {
  const { data } = await api.post(`/marketplace/vendeur/ventes/${id}/annuler`, { motif: motif || undefined });
  return data;
};

// Offres actives des livreurs (mode reseau), triees par montant croissant.
const offresLivraison = async (id) => {
  const { data } = await api.get(`/marketplace/vendeur/ventes/${id}/livraison/offres`);
  return data.offres ?? [];
};

const accepterOffre = async (id, offreId) => {
  const { data } = await api.post(`/marketplace/vendeur/ventes/${id}/livraison/offres/${offreId}/accepter`);
  return data.livraison;
};

// --- Solde informatif (section 8) — hors middleware d'abonnement --------------

const solde = async () => {
  const { data } = await api.get('/marketplace/solde');
  return data.solde_marketplace ?? 0;
};

const soldeHistorique = async () => {
  const { data } = await api.get('/marketplace/solde/historique');
  return data.historique ?? [];
};

const marketplaceService = {
  catalogue,
  catalogueShow,
  vendeurMoyensPaiement,
  validerPanier,
  declarerPaiementCommande,
  mesAchats,
  commandeShow,
  mesAnnonces,
  annonceShow,
  creerAnnonce,
  modifierAnnonce,
  publierAnnonce,
  depublierAnnonce,
  supprimerPhoto,
  mesMoyensPaiement,
  ajouterMoyenPaiement,
  modifierMoyenPaiement,
  supprimerMoyenPaiement,
  mesVentes,
  venteShow,
  confirmerPaiement,
  infirmerPaiement,
  livraisonReseau,
  livraisonDirect,
  livraisonHorsPlateforme,
  marquerLivree,
  rechercherLivreur,
  annulerCommande,
  annulerVente,
  offresLivraison,
  accepterOffre,
  solde,
  soldeHistorique,
};

export { toFormData, multipart };
export default marketplaceService;
