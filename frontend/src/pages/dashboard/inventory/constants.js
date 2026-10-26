export const EMPTY_ENTRY = { product: '', variant: '', quantity: '', type: 'in', warehouse: '' };
export const EMPTY_ADJUST = { product: '', variant: '', quantity: '', warehouse: '' };
export const EMPTY_TRANSFER = { product: '', variant: '', quantity: '', from_store: '', to_store: '', from_warehouse: '', to_warehouse: '' };

export const TYPE_LABELS = {
  in: 'Entrée',
  out: 'Sortie',
  adjustment: 'Ajustement',
  purchase_in: 'Entrée achat',
  sale_out: 'Vente',
  sale_cancel_in: 'Annulation vente',
  transfer_out: 'Transfert sortant',
  transfer_in: 'Transfert entrant',
  inventory: 'Inventaire',
  loss: 'Perte',
  breakage: 'Casse',
  return_in: 'Retour client',
  initial: 'Stock initial',
};

export const TYPE_STYLES = {
  in: 'bg-green-100 text-green-700',
  out: 'bg-red-100 text-red-700',
  adjustment: 'bg-orange-100 text-orange-700',
  purchase_in: 'bg-green-100 text-green-700',
  sale_out: 'bg-red-100 text-red-700',
  sale_cancel_in: 'bg-blue-100 text-blue-700',
  transfer_out: 'bg-purple-100 text-purple-700',
  transfer_in: 'bg-purple-100 text-purple-700',
  inventory: 'bg-cyan-100 text-cyan-700',
  loss: 'bg-red-100 text-red-700',
  breakage: 'bg-red-100 text-red-700',
  return_in: 'bg-blue-100 text-blue-700',
  initial: 'bg-green-100 text-green-700',
};

/**
 * Stock de la ligne réellement ciblée par un formulaire de stock :
 * (entrepôt, variante). Sans entrepôt connu, retombe sur l'agrégat
 * magasin puis global — cohérent avec resolve_warehouse côté backend.
 */
export const lineStock = (p, { storeUuid, warehouseUuid, variantUuid } = {}) => {
  const rows = p?.stock_by_warehouse || [];
  const match = (r) =>
    (!storeUuid || !r.store || r.store?.uuid === storeUuid) &&
    (!warehouseUuid || r.warehouse?.uuid === warehouseUuid) &&
    (r.variant?.uuid || null) === (variantUuid || null);
  if (warehouseUuid || variantUuid) {
    return rows.filter(match).reduce((sum, r) => sum + (r.quantity || 0), 0);
  }
  if (storeUuid) {
    return p?.stock_by_store?.find((s) => s.store?.uuid === storeUuid)?.quantity ?? 0;
  }
  return p?.stock_quantity || 0;
};

export const inputClass = 'w-full px-4 py-3 border border-border rounded-xl text-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500';
export const labelClass = 'block text-base font-medium text-foreground mb-1.5';
export const btnPrimary = 'flex items-center gap-2 h-12 px-6 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-base font-semibold transition-colors';
export const btnSecondary = 'flex items-center gap-2 h-12 px-6 rounded-xl border border-border text-foreground text-base font-medium hover:bg-gray-50 transition-colors';
export const btnIcon = 'p-2.5 rounded-xl text-muted hover:text-primary-600 hover:bg-primary-50 transition-colors';
export const btnDanger = 'p-2.5 rounded-xl text-muted hover:text-red-600 hover:bg-red-50 transition-colors';
