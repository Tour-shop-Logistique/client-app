import api from './api';

// Historique persiste des notifications du client (user-parcour/api-client-livreur.md,
// « Notifications client »). Canal `database` : meme contenu que le web push,
// partage entre appareils.

const BASE = '/expedition/client/notifications';

// GET /expedition/client/notifications?page= — paginee, 20/page.
const fetchPage = async (page = 1) => {
  const { data } = await api.get(BASE, { params: { page } });
  return data?.notifications ?? data;
};

// POST /expedition/client/notifications/{id}/lue
const markRead = async (id) => {
  const { data } = await api.post(`${BASE}/${id}/lue`);
  return data;
};

// POST /expedition/client/notifications/tout-lire
const markAllRead = async () => {
  const { data } = await api.post(`${BASE}/tout-lire`);
  return data;
};

// DELETE /expedition/client/notifications/{id}
const remove = async (id) => {
  const { data } = await api.delete(`${BASE}/${id}`);
  return data;
};

const notificationService = {
  fetchPage, markRead, markAllRead, remove,
};

export default notificationService;
