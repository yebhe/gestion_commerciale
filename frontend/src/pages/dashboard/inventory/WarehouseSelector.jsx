import { Warehouse } from 'lucide-react';
import { inputClass } from './constants';

/**
 * Sélecteur d'entrepôt, affiché sous le StoreSelector (_docs/15, étape 1.8).
 * Masqué automatiquement si le magasin n'a qu'un seul entrepôt actif
 * (mode simple, doc 07) — dans ce cas onChange est appelé avec l'uuid
 * de l'entrepôt par défaut via l'effet du parent.
 */
const WarehouseSelector = ({ warehouses, selectedWarehouseUuid, onChange, error }) => {
  const active = (warehouses || []).filter((w) => w.is_active !== false);
  if (active.length <= 1) return null;

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
      <div className="flex items-center gap-3 mb-2">
        <Warehouse size={24} className="text-primary-600" />
        <label className="text-base font-semibold text-foreground">
          Entrepôt
        </label>
      </div>
      <select
        value={selectedWarehouseUuid}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        {active.map((w) => (
          <option key={w.uuid} value={w.uuid}>
            {w.name}{w.is_default ? ' (par défaut)' : ''}
          </option>
        ))}
      </select>
      {error && <p className="text-base text-red-600 mt-2">{error}</p>}
    </div>
  );
};

export default WarehouseSelector;
