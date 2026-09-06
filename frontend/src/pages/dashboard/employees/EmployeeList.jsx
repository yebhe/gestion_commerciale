import {
  Pencil, Trash2, UserPlus, Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Loader from '../../../contexts/Loader';
import {
  btnPrimary, btnSecondary, btnIcon, btnDanger, initials,
} from './constants';

const EmployeeList = ({
  employees, loading, error, search, page, count, next, prev,
  canCreate, canUpdate, canDelete,
  onSearchChange, onPageChange, onEdit, onDelete, onCreate,
}) => (
  <>
    <div className="flex items-center justify-between mb-6">
      <p className="text-muted text-lg">{employees.length} employé(s)</p>
      {canCreate && (
        <button type="button" onClick={onCreate} className={btnPrimary}>
          <UserPlus size={24} />
          Ajouter un employé
        </button>
      )}
    </div>

    <div className="relative mb-4">
      <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Rechercher un employé..."
        className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>

    {error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-base mb-4">{error}</div>
    )}

    {loading ? (
      <Loader fullscreen={false} />
    ) : employees.length === 0 ? (
      <p className="text-muted text-lg">Aucun employé pour le moment.</p>
    ) : (
      <ul className="divide-y divide-border bg-surface rounded-2xl border border-border">
        {employees.map((emp) => (
          <li key={emp.uuid} className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-lg flex-shrink-0">
                {initials(emp) || '?'}
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">{emp.user?.first_name} {emp.user?.last_name}</p>
                <p className="text-base text-muted">
                  {emp.user?.email}
                  {emp.role ? ` — ${emp.role.name}` : ''}
                  {emp.store ? ` — ${emp.store.name}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canUpdate && (
                <button onClick={() => onEdit(emp)} className={btnIcon}><Pencil size={22} /></button>
              )}
              {canDelete && (
                <button onClick={() => onDelete(emp)} className={btnDanger}><Trash2 size={22} /></button>
              )}
            </div>
          </li>
        ))}
      </ul>
    )}

    {(next || prev) && (
      <div className="flex items-center justify-between mt-6">
        <p className="text-muted text-base">{count} employé(s) au total</p>
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))} disabled={!prev}
            className={`${btnSecondary} ${!prev ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <ChevronLeft size={20} />
            Précédent
          </button>
          <span className="text-base font-medium text-foreground">Page {page}</span>
          <button type="button"
            onClick={() => onPageChange(page + 1)} disabled={!next}
            className={`${btnSecondary} ${!next ? 'opacity-40 cursor-not-allowed' : ''}`}>
            Suivant
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    )}
  </>
);

export default EmployeeList;
