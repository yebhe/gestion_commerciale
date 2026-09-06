import { X } from 'lucide-react';
import { inputClass, labelClass, btnPrimary } from './constants';

const CategoryForm = ({
  editingCategory, categoryForm, categoryError, submitting,
  onChange, onSubmit, onClose,
}) => (
  <form onSubmit={onSubmit} className="bg-surface rounded-2xl border border-border p-6 mb-6 space-y-4 relative">
    <button type="button" onClick={onClose}
      className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
      <X size={24} />
    </button>
    <h2 className="text-xl font-bold text-foreground">
      {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
    </h2>
    {categoryError && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base">{categoryError}</div>
    )}
    <div>
      <label className={labelClass}>Nom de la catégorie</label>
      <input name="name" value={categoryForm.name} onChange={onChange}
        className={inputClass} placeholder="Ex: Boissons" />
    </div>
    <button type="submit" disabled={submitting}
      className={`${btnPrimary} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {submitting ? 'Enregistrement...' : 'Enregistrer'}
    </button>
  </form>
);

export default CategoryForm;
