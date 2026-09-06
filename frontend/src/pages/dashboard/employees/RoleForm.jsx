import { X } from 'lucide-react';
import Loader from '../../../contexts/Loader';
import {
  inputClass, labelClass, btnPrimary,
} from './constants';

const RoleForm = ({
  editingItem, roleForm, selectedPermissions, allPermissions,
  canAssignPermissions, error, submitting,
  onRoleFormChange, onPermissionToggle, onSubmit, onClose,
}) => (
  <div className="bg-surface rounded-2xl border border-border p-6 mb-6 space-y-5 relative">
    <button type="button" onClick={onClose}
      className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
      <X size={24} />
    </button>
    <h2 className="text-xl font-bold text-foreground">
      {editingItem ? 'Modifier le rôle' : 'Nouveau rôle'}
    </h2>

    {error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base">{error}</div>
    )}

    <div>
      <label className={labelClass}>Nom du rôle</label>
      <input value={roleForm.name}
        onChange={(e) => onRoleFormChange({ ...roleForm, name: e.target.value })}
        className={inputClass} placeholder="Ex: Gestionnaire de stock" />
    </div>
    <div>
      <label className={labelClass}>Description</label>
      <textarea value={roleForm.description}
        onChange={(e) => onRoleFormChange({ ...roleForm, description: e.target.value })}
        className={inputClass} rows={2} placeholder="Description du rôle" />
    </div>
    {!editingItem && (
      <div>
        <label className={labelClass}>Scope</label>
        <select value={roleForm.scope}
          onChange={(e) => onRoleFormChange({ ...roleForm, scope: e.target.value })}
          className={inputClass}>
          <option value="COMPANY">Entreprise (tous les magasins)</option>
          <option value="STORE">Magasin (un seul magasin)</option>
        </select>
      </div>
    )}

    {canAssignPermissions && (
      <div>
        <label className={labelClass}>Permissions</label>
        <div className="border border-border rounded-xl p-4 max-h-60 overflow-y-auto space-y-2">
          {allPermissions.map((perm) => (
            <label key={perm.code} className="flex items-center gap-3 text-base text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPermissions.includes(perm.code)}
                onChange={(e) => onPermissionToggle(perm.code, e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <span className="font-medium">{perm.name}</span>
                <span className="text-muted text-sm ml-2">{perm.code}</span>
              </div>
            </label>
          ))}
          {allPermissions.length === 0 && (
            <Loader fullscreen={false} />
          )}
        </div>
        <p className="text-sm text-muted mt-2">{selectedPermissions.length} permission(s) sélectionnée(s)</p>
      </div>
    )}

    <button type="button" onClick={onSubmit} disabled={submitting}
      className={`${btnPrimary} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {submitting ? 'Enregistrement...' : 'Enregistrer'}
    </button>
  </div>
);

export default RoleForm;
