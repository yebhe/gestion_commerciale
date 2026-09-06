import { ClipboardList, ShieldCheck, Check } from 'lucide-react';

export const EMPTY_FORM = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  phone: '',
  role: '',
  store: '',
};

export const EMPLOYEE_STEPS = [
  { key: 0, label: 'Informations', icon: ClipboardList },
  { key: 1, label: 'Rôle', icon: ShieldCheck },
  { key: 2, label: 'Confirmation', icon: Check },
];

export const EMPTY_ROLE_FORM = { name: '', description: '', scope: 'COMPANY' };

export function validateEmployeeStep(step, form, isEdit) {
  const errors = {};
  if (step === 0) {
    if (!form.email.trim()) {
      errors.email = 'L\'email est obligatoire.';
    } else if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.email = 'L\'email n\'est pas valide.';
    }
    if (!isEdit && !form.password) {
      errors.password = 'Le mot de passe est obligatoire.';
    } else if (!isEdit && form.password.length < 6) {
      errors.password = 'Le mot de passe doit contenir au moins 6 caractères.';
    }
    if (!form.first_name.trim()) errors.first_name = 'Le prénom est obligatoire.';
    if (!form.last_name.trim()) errors.last_name = 'Le nom est obligatoire.';
  }
  if (step === 1) {
    if (!form.role) errors.role = 'Veuillez sélectionner un rôle.';
  }
  return errors;
}

export const inputClass = 'w-full px-4 py-3 border border-border rounded-xl text-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500';
export const labelClass = 'block text-base font-medium text-foreground mb-1.5';
export const btnPrimary = 'flex items-center gap-2 h-12 px-6 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-base font-semibold transition-colors';
export const btnSecondary = 'flex items-center gap-2 h-12 px-6 rounded-xl border border-border text-foreground text-base font-medium hover:bg-gray-50 transition-colors';
export const btnIcon = 'p-2.5 rounded-xl text-muted hover:text-primary-600 hover:bg-primary-50 transition-colors';
export const btnDanger = 'p-2.5 rounded-xl text-muted hover:text-red-600 hover:bg-red-50 transition-colors';

export function initials(emp) {
  return `${emp.user?.first_name?.[0] || ''}${emp.user?.last_name?.[0] || ''}`.toUpperCase();
}
