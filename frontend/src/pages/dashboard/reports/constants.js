export const inputClass = 'w-full px-4 py-3 border border-border rounded-xl text-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500';
export const labelClass = 'block text-base font-medium text-foreground mb-1.5';
export const btnPrimary = 'flex items-center gap-2 h-12 px-6 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-base font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const btnSecondary = 'flex items-center gap-2 h-12 px-6 rounded-xl border border-border text-foreground text-base font-medium hover:bg-gray-50 transition-colors';

export const PAYMENT_LABELS = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  card: 'Carte',
  credit: 'Crédit',
};

export const MOVEMENT_LABELS = {
  in: 'Entrées',
  out: 'Sorties',
  adjustment: 'Ajustements',
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

export const defaultDateRange = () => ({
  date_from: daysAgoIso(29),
  date_to: todayIso(),
});

export const formatFCFA = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
