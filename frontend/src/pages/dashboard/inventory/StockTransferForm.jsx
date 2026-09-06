import { X } from 'lucide-react';
import { inputClass, labelClass, btnPrimary } from './constants';

const StockTransferForm = ({
  form, products, stores, fromStoreUuid, error, submitting,
  onChange, onSubmit, onClose,
}) => {
  const fromStore = fromStoreUuid || form.from_store;
  const fromStoreObj = stores.find((s) => s.uuid === fromStore);
  const fromStoreStock = (p) => {
    if (!fromStore) return p.stock_quantity;
    return p.stock_by_store?.find((s) => s.store?.uuid === fromStore)?.quantity || 0;
  };
  return (
  <div className="bg-surface rounded-2xl border border-border p-6 mb-6 space-y-4 relative">
    <button type="button" onClick={onClose}
      className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
      <X size={24} />
    </button>
    <h2 className="text-xl font-bold text-foreground">Transfert de stock</h2>

    {error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base">{error}</div>
    )}

    <div>
      <label className={labelClass}>Produit</label>
      <select name="product" value={form.product} onChange={onChange} className={inputClass}>
        <option value="">— Sélectionner —</option>
        {products.map((p) => (
          <option key={p.uuid} value={p.uuid}>{p.name} (Stock: {fromStoreStock(p)})</option>
        ))}
      </select>
    </div>

    <div>
      <label className={labelClass}>Magasin source</label>
      {fromStoreUuid ? (
        <input type="text" value={fromStoreObj?.name || '—'} disabled
          className={`${inputClass} bg-gray-100 cursor-not-allowed`} />
      ) : (
        <select name="from_store" value={form.from_store} onChange={onChange} className={inputClass}>
          <option value="">— Sélectionner —</option>
          {stores.map((s) => (
            <option key={s.uuid} value={s.uuid}>{s.name}</option>
          ))}
        </select>
      )}
    </div>

    <div>
      <label className={labelClass}>Magasin destination</label>
      <select name="to_store" value={form.to_store} onChange={onChange} className={inputClass}>
        <option value="">— Sélectionner —</option>
        {stores.filter((s) => s.uuid !== fromStore).map((s) => (
          <option key={s.uuid} value={s.uuid}>{s.name}</option>
        ))}
      </select>
    </div>

    <div>
      <label className={labelClass}>Quantité à transférer</label>
      <input name="quantity" type="number" min="1" value={form.quantity}
        onChange={onChange} className={inputClass} placeholder="Ex: 20" />
    </div>

    <button type="button" onClick={onSubmit} disabled={submitting}
      className={`${btnPrimary} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {submitting ? 'Enregistrement...' : 'Enregistrer le transfert'}
    </button>
  </div>
  );
};

export default StockTransferForm;
