import api from './api';

const getMyReferral = async () => {
  const { data } = await api.get('/parrainage/moi');
  return data;
};

const applyReferralCode = async (code) => {
  const { data } = await api.post('/parrainage/appliquer', { code });
  return data;
};

const referralService = { getMyReferral, applyReferralCode };

export default referralService;
