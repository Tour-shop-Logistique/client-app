export const formatPrice = (value, currency = 'FCFA') => {
  if (value === null || value === undefined) return '-';
  return `${new Intl.NumberFormat('fr-FR').format(value)} ${currency}`;
};

export const formatDate = (value, options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('fr-FR', options).format(new Date(value));
};

export const formatDateTime = (value) =>
  formatDate(value, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
