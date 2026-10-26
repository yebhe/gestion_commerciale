import { X } from 'lucide-react';
import VariantSelect from './VariantSelect';
import { inputClass, labelClass, btnPrimary, lineStock } from './constants';

const StockAdjustForm = ({
  form, products, error, submitting, storeUuid, warehouseUuid,
  onChange, onSubmit, onClose,
}) => {
  const selected = products.find((p) => p.uuid === form.product);
  const current = selected
    ? lineStock(selected, { storeUuid, warehouseUuid, variantUuid: form.variant })
    : null;
  return (
  <div className="bg-surface rounded-2xl border border-border p-6 mb-6 space-y-4 relative">
    <button type="button" onClick={onClose}
      className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
      <X size={24} />
    </button>
    <h2 className="text-xl font-bold text-foreground">Ajustement de stock</h2>

    {error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base">{error}</div>
    )}

    <div>
      <label className={labelClass}>Produit</label>
      <select name="product" value={form.product} onChange={onChange} className={inputClass}>
        <option value="">— Sélectionner —</option>
        {products.map((p) => {
          const qty = lineStock(p, { storeUuid, warehouseUuid });
          return (
            <option key={p.uuid} value={p.uuid}>{p.name} (Stock: {qty})</option>
          );
        })}
      </select>
    </div>

    <VariantSelect productUuid={form.product} value={form.variant} onChange={onChange} />

    <div>
      <label className={labelClass}>Nouvelle quantité en stock</label>
      <input name="quantity" type="number" min="0" value={form.quantity}
        onChange={onChange} className={inputClass} placeholder="Ex: 100" />
      <p className="text-sm text-muted mt-1">
        {current !== null
          ? <>Stock actuel de cette ligne : <strong>{current}</strong>. Saisissez la quantité réelle comptée.</>
          : 'Saisissez la quantité réelle comptée en stock.'}
      </p>
    </div>

    <button type="button" onClick={onSubmit} disabled={submitting}
      className={`${btnPrimary} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {submitting ? 'Enregistrement...' : 'Enregistrer l\'ajustement'}
    </button>
  </div>
  );
};

export default StockAdjustForm;
