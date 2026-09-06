export const EMPTY_FORM = {
  customer: '',
  payment_method: 'cash',
  items: [{ product: '', quantity: 1 }],
};

export const PAYMENT_LABELS = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  card: 'Carte',
  credit: 'Crédit',
};

export const PAYMENT_STYLES = {
  cash: 'bg-green-100 text-green-700',
  mobile_money: 'bg-blue-100 text-blue-700',
  card: 'bg-purple-100 text-purple-700',
  credit: 'bg-orange-100 text-orange-700',
};

export const STATUS_LABELS = {
  pending: 'En attente',
  completed: 'Terminée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
};

export const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-orange-100 text-orange-700',
};

export const inputClass = 'w-full px-4 py-3 border border-border rounded-xl text-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500';
export const selectClass = 'flex-1 min-w-0 px-4 py-3 border border-border rounded-xl text-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500';
export const qtyClass = 'w-24 flex-shrink-0 px-4 py-3 border border-border rounded-xl text-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 text-center';
export const labelClass = 'block text-base font-medium text-foreground mb-1.5';
export const btnPrimary = 'flex items-center gap-2 h-12 px-6 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-base font-semibold transition-colors';
export const btnSecondary = 'flex items-center gap-2 h-12 px-6 rounded-xl border border-border text-foreground text-base font-medium hover:bg-gray-50 transition-colors';
export const btnIcon = 'p-2.5 rounded-xl text-muted hover:text-primary-600 hover:bg-primary-50 transition-colors';
export const btnDanger = 'flex items-center gap-2 h-10 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium transition-colors';
