import { Plus, Pencil, Trash2, Search, ShieldCheck } from 'lucide-react';
import Loader from '../../../contexts/Loader';
import { btnPrimary, btnIcon, btnDanger } from './constants';

const RolesList = ({
  roles, loading, error, search,
  canCreate, canUpdate, canDelete,
  onSearchChange, onEdit, onDelete, onCreate,
}) => {
  const customRoles = roles.filter((r) => !r.is_system);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted text-lg">{customRoles.length} rôle(s) personnalisé(s)</p>
        {canCreate && (
          <button type="button" onClick={onCreate} className={btnPrimary}>
            <Plus size={24} />
            Ajouter un rôle
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher un rôle..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-base mb-4">{error}</div>
      )}

      {loading ? (
        <Loader fullscreen={false} />
      ) : customRoles.length === 0 ? (
        <p className="text-muted text-lg">Aucun rôle personnalisé pour le moment.</p>
      ) : (
        <ul className="divide-y divide-border bg-surface rounded-2xl border border-border">
          {customRoles.map((role) => (
            <li key={role.uuid} className="py-4 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={26} className="text-primary-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-lg">
                      {role.name}
                      <span className={`inline-block text-sm px-2 py-0.5 rounded-full ml-1 ${
                        role.scope === 'COMPANY' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {role.scope === 'COMPANY' ? 'Entreprise' : 'Magasin'}
                      </span>
                    </p>
                    {role.description && (
                      <p className="text-base text-muted">{role.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canUpdate && (
                    <button onClick={() => onEdit(role)} className={btnIcon}><Pencil size={22} /></button>
                  )}
                  {canDelete && (
                    <button onClick={() => onDelete(role)} className={btnDanger}><Trash2 size={22} /></button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

export default RolesList;
