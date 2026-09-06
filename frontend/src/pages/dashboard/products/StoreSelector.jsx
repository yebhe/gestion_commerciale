import { Store } from 'lucide-react';
import { inputClass } from './constants';

const StoreSelector = ({ stores, selectedStoreUuid, onChange, error }) => (
  <div className="bg-primary-50 border border-primary-200 rounded-2xl p-5 mb-6">
    <div className="flex items-center gap-3 mb-2">
      <Store size={28} className="text-primary-600" />
      <label className="text-base font-semibold text-foreground">
        Sélectionnez un magasin
      </label>
    </div>
    <p className="text-base text-muted mb-3">
      Vous devez sélectionner un magasin pour consulter, ajouter ou modifier les produits et catégories.
    </p>
    <select
      value={selectedStoreUuid}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    >
      <option value="">— Choisir un magasin —</option>
      {stores.map((s) => (
        <option key={s.uuid} value={s.uuid}>{s.name}</option>
      ))}
    </select>
    {error && <p className="text-base text-red-600 mt-2">{error}</p>}
  </div>
);

export default StoreSelector;
