import { X, Plus, Trash2 } from 'lucide-react';
import { inputClass, selectClass, qtyClass, labelClass, btnPrimary, PAYMENT_LABELS } from './constants';

const SaleForm = ({
  form, products, customers, error, submitting, total, storeUuid,
  onChange, onItemChange, onAddItem, onRemoveItem,
  onSubmit, onClose,
}) => (
  <div className="bg-surface rounded-2xl border border-border p-6 mb-6 space-y-4 relative">
    <button type="button" onClick={onClose}
      className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
      <X size={24} />
    </button>
    <h2 className="text-xl font-bold text-foreground">Nouvelle vente</h2>

    {error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base">{error}</div>
    )}

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className={labelClass}>Client (optionnel)</label>
        <select name="customer" value={form.customer} onChange={onChange} className={inputClass}>
          <option value="">— Client de passage —</option>
          {customers.map((c) => (
            <option key={c.uuid} value={c.uuid}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Mode de paiement</label>
        <select name="payment_method" value={form.payment_method} onChange={onChange} className={inputClass}>
          {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
    </div>

    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={labelClass}>Articles</label>
        <button type="button" onClick={onAddItem}
          className="flex items-center gap-1 text-primary-600 text-sm font-medium">
          <Plus size={18} /> Ajouter un article
        </button>
      </div>

      {form.items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-3 mb-3">
          <select
            value={item.product}
            onChange={(e) => onItemChange(idx, 'product', e.target.value)}
            className={selectClass}
          >
            <option value="">— Sélectionner un produit —</option>
            {products.map((p) => {
              const storeStock = storeUuid
                ? (p.stock_by_store?.find((s) => s.store?.uuid === storeUuid)?.quantity || 0)
                : p.stock_quantity;
              return (
                <option key={p.uuid} value={p.uuid}>
                  {p.name} ({p.selling_price} FCFA — Stock: {storeStock})
                </option>
              );
            })}
          </select>
          <input
            type="number" min="1" value={item.quantity}
            onChange={(e) => onItemChange(idx, 'quantity', e.target.value)}
            className={qtyClass}
            placeholder="Qté"
          />
          {form.items.length > 1 && (
            <button type="button" onClick={() => onRemoveItem(idx)}
              className="p-2.5 rounded-xl text-muted hover:text-red-600 hover:bg-red-50">
              <Trash2 size={20} />
            </button>
          )}
        </div>
      ))}
    </div>

    <div className="flex items-center justify-between pt-4 border-t border-border">
      <div>
        <p className="text-sm text-muted">Total</p>
        <p className="text-2xl font-bold text-primary-600">{total} FCFA</p>
      </div>
      <button type="button" onClick={onSubmit} disabled={submitting}
        className={`${btnPrimary} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {submitting ? 'Enregistrement...' : 'Enregistrer la vente'}
      </button>
    </div>
  </div>
);

export default SaleForm;
