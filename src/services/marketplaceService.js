import api from './api';

const listProducts = async (params = {}) => {
  const { data } = await api.get('/marketplace/produits', { params });
  return data;
};

const getProduct = async (id) => {
  const { data } = await api.get(`/marketplace/produits/${id}`);
  return data;
};

const createProduct = async (formData) => {
  const { data } = await api.post('/marketplace/produits', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

const myListings = async () => {
  const { data } = await api.get('/marketplace/mes-produits');
  return data;
};

const myOrders = async () => {
  const { data } = await api.get('/marketplace/mes-commandes');
  return data;
};

const checkout = async ({ items, deliveryMode }) => {
  const { data } = await api.post('/marketplace/commandes', { items, delivery_mode: deliveryMode });
  return data;
};

const setDeliveryMode = async (orderId, { mode, livreurId, tarif }) => {
  const { data } = await api.post(`/marketplace/commandes/${orderId}/livraison`, {
    mode, // 'reseau' | 'affectation_directe' | 'hors_plateforme'
    livreur_id: livreurId,
    tarif,
  });
  return data;
};

const marketplaceService = {
  listProducts,
  getProduct,
  createProduct,
  myListings,
  myOrders,
  checkout,
  setDeliveryMode,
};

export default marketplaceService;
