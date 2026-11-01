import api from './api';

// Historique persiste des notifications du client (DEMANDE_BACKEND_APP_CLIENT_COMPLETE.md
// F1 / DEMANDES_BACKEND_CLIENT.md C5) : meme contrat que /livreur/notifications.
// ATTENTION : ces routes sont demandees au backend, elles peuvent ne pas exister
// encore (404/405) ; le store traite ce cas comme "historique serveur indisponible"
// sans erreur visible, et l'ecran reste alimente par le fil local.

// GET /client/notifications?page= — pagine 20/page, `non_lues` = total non lues.
const fetchPage = async (page = 1) => {
  const { data } = await api.get('/client/notifications', { params: { page } });
  return data?.notifications ?? data;
};

// POST /client/notifications/{id}/lue
const markRead = async (id) => {
  const { data } = await api.post(`/client/notifications/${id}/lue`);
  return data;
};

// POST /client/notifications/tout-lire
const markAllRead = async () => {
  const { data } = await api.post('/client/notifications/tout-lire');
  return data;
};

const notificationService = { fetchPage, markRead, markAllRead };

export default notificationService;
