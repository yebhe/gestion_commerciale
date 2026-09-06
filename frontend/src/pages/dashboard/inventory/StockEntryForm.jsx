import { X } from 'lucide-react';
import { inputClass, labelClass, btnPrimary, EMPTY_ENTRY } from './constants';

const StockEntryForm = ({
  form, products, error, submitting, storeUuid,
  onChange, onSubmit, onClose,
}) => {
  const storeStock = (p) => {
    if (!storeUuid) return p.stock_quantity;
    return p.stock_by_store?.find((s) => s.store?.uuid === storeUuid)?.quantity ?? 0;
  };
  return (
  <div className="bg-surface rounded-2xl border border-border p-6 mb-6 space-y-4 relative">
    <button type="button" onClick={onClose}
      className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
      <X size={24} />
    </button>
    <h2 className="text-xl font-bold text-foreground">Entrée de stock</h2>

    {error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base">{error}</div>
    )}

    <div>
      <label className={labelClass}>Produit</label>
      <select name="product" value={form.product} onChange={onChange} className={inputClass}>
        <option value="">— Sélectionner —</option>
        {products.map((p) => (
          <option key={p.uuid} value={p.uuid}>{p.name} (Stock: {storeStock(p)})</option>
        ))}
      </select>
    </div>

    <div>
      <label className={labelClass}>Quantité à ajouter</label>
      <input name="quantity" type="number" min="1" value={form.quantity}
        onChange={onChange} className={inputClass} placeholder="Ex: 50" />
    </div>

    <button type="button" onClick={onSubmit} disabled={submitting}
      className={`${btnPrimary} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {submitting ? 'Enregistrement...' : 'Enregistrer l\'entrée'}
    </button>
  </div>
  );
};

export default StockEntryForm;
