import api from './api';

const list = async (params = {}) => {
  const { data } = await api.get('/agences', { params });
  return data;
};

const getById = async (id) => {
  const { data } = await api.get(`/agences/${id}`);
  return data;
};

const agencyService = { list, getById };

export default agencyService;
