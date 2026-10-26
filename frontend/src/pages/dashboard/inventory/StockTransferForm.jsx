import { X } from 'lucide-react';
import VariantSelect from './VariantSelect';
import { inputClass, labelClass, btnPrimary, lineStock } from './constants';

const StockTransferForm = ({
  form, products, stores, fromStoreUuid, warehouseUuid, error, submitting,
  onChange, onSubmit, onClose,
}) => {
  // onSubmit(immediate:boolean) — true = "Transférer maintenant",
  // false = "Créer une demande" (workflow avec statuts).
  const fromStore = fromStoreUuid || form.from_store;
  const fromStoreObj = stores.find((s) => s.uuid === fromStore);
  const fromStoreStock = (p) =>
    lineStock(p, { storeUuid: fromStore, warehouseUuid, variantUuid: form.variant });
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

    <VariantSelect productUuid={form.product} value={form.variant} onChange={onChange} />

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

    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => onSubmit(true)} disabled={submitting}
        className={`${btnPrimary} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {submitting ? 'Enregistrement...' : 'Transférer maintenant'}
      </button>
      <button type="button" onClick={() => onSubmit(false)} disabled={submitting}
        className="flex items-center gap-2 h-12 px-6 rounded-xl border border-border text-foreground text-base font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
        Créer une demande
      </button>
    </div>
  </div>
  );
};

export default StockTransferForm;
