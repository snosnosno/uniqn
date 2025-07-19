export const formatCurrency = (amount: number, currency: string, language: string): string => {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatDate = (date: Date, language: string): string => {
  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}; 