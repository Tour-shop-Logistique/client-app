import api from './api';

// Catalogue produits pour les devis d'expedition (distinct du catalogue
// marketplace) — voir api-devis-client.md.
const list = async (params = {}) => {
  const { data } = await api.get('/produits', { params });
  return data;
};

const produitService = { list };

export default produitService;
