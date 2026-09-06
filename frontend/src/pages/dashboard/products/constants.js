import { ClipboardList, DollarSign, Boxes, Image as ImageIcon, Check } from 'lucide-react';

export const EMPTY_PRODUCT = {
  name: '', description: '', barcode: '',
  purchase_price: '', selling_price: '', stock_quantity: '', category: '',
};

export const EMPTY_CATEGORY = { name: '' };

export const PRODUCT_STEPS = [
  { key: 0, label: 'Informations', icon: ClipboardList },
  { key: 1, label: 'Prix', icon: DollarSign },
  { key: 2, label: 'Stock', icon: Boxes },
  { key: 3, label: 'Image', icon: ImageIcon },
  { key: 4, label: 'Confirmation', icon: Check },
];

export function validateProductStep(step, form) {
  const errors = {};
  if (step === 0) {
    if (!form.name.trim()) errors.name = 'Veuillez saisir le nom du produit.';
  }
  if (step === 1) {
    if (form.selling_price === '' || parseFloat(form.selling_price) < 0)
      errors.selling_price = 'Le prix de vente doit être supérieur ou égal à zéro.';
    if (form.purchase_price !== '' && parseFloat(form.purchase_price) < 0)
      errors.purchase_price = 'Le prix d\'achat doit être supérieur ou égal à zéro.';
  }
  if (step === 2) {
    if (form.stock_quantity === '' || parseInt(form.stock_quantity) < 0)
      errors.stock_quantity = 'Veuillez indiquer la quantité disponible.';
  }
  return errors;
}

export const inputClass = 'w-full px-4 py-3 border border-border rounded-xl text-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed';
export const labelClass = 'block text-base font-medium text-foreground mb-1.5';
export const btnPrimary = 'flex items-center gap-2 h-12 px-6 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-base font-semibold transition-colors';
export const btnSecondary = 'flex items-center gap-2 h-12 px-6 rounded-xl border border-border text-foreground text-base font-medium hover:bg-gray-50 transition-colors';
export const btnIcon = 'p-2.5 rounded-xl text-muted hover:text-primary-600 hover:bg-primary-50 transition-colors';
export const btnDanger = 'p-2.5 rounded-xl text-muted hover:text-red-600 hover:bg-red-50 transition-colors';
