import { X } from 'lucide-react';
import { inputClass, labelClass, btnPrimary } from './constants';

const SupplierForm = ({
  editingSupplier, form, error, submitting, stores, isCompanyScope,
  onChange, onSubmit, onClose,
}) => (
  <form onSubmit={onSubmit} className="bg-surface rounded-2xl border border-border p-6 mb-6 space-y-4 relative">
    <button type="button" onClick={onClose}
      className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
      <X size={24} />
    </button>
    <h2 className="text-xl font-bold text-foreground">
      {editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
    </h2>

    {error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base">{error}</div>
    )}

    {isCompanyScope && (
      <div>
        <label className={labelClass}>Magasin</label>
        <select name="store" value={form.store} onChange={onChange} className={inputClass}>
          <option value="">— Aucun magasin (global) —</option>
          {stores.map((s) => (
            <option key={s.uuid} value={s.uuid}>{s.name}</option>
          ))}
        </select>
      </div>
    )}

    <div>
      <label className={labelClass}>Nom du fournisseur</label>
      <input name="name" value={form.name} onChange={onChange}
        className={inputClass} placeholder="Ex: Distributeur ABC" required />
    </div>

    <div>
      <label className={labelClass}>Téléphone</label>
      <input name="phone" value={form.phone} onChange={onChange}
        className={inputClass} placeholder="Ex: +221 77 123 45 67" />
    </div>

    <div>
      <label className={labelClass}>Email</label>
      <input name="email" type="email" value={form.email} onChange={onChange}
        className={inputClass} placeholder="Ex: contact@abc.com" />
    </div>

    <button type="submit" disabled={submitting}
      className={`${btnPrimary} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {submitting ? 'Enregistrement...' : 'Enregistrer'}
    </button>
  </form>
);

export default SupplierForm;
