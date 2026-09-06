import {
  Users, Plus, Pencil, Trash2, Search, Phone, Mail,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import Loader from '../../../contexts/Loader';
import { btnPrimary, btnSecondary, btnIcon, btnDanger } from './constants';

const CustomerList = ({
  customers, loading, search, page, count, next, prev,
  canCreate, canUpdate, canDelete,
  onSearchChange, onPageChange, onEdit, onDelete, onCreate,
}) => (
  <>
    <div className="flex items-center justify-between mb-6">
      <p className="text-muted text-lg">{count} client(s)</p>
      {canCreate && (
        <button type="button" onClick={onCreate} className={btnPrimary}>
          <Plus size={24} />
          Ajouter un client
        </button>
      )}
    </div>

    <div className="relative mb-4">
      <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Rechercher un client..."
        className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>

    {loading ? (
      <Loader fullscreen={false} />
    ) : customers.length === 0 ? (
      <p className="text-muted text-lg">Aucun client pour le moment.</p>
    ) : (
      <ul className="divide-y divide-border bg-surface rounded-2xl border border-border">
        {customers.map((customer) => (
          <li key={customer.uuid} className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Users size={24} className="text-primary-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">{customer.name}</p>
                <div className="flex items-center gap-4 text-base text-muted">
                  {customer.phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={16} /> {customer.phone}
                    </span>
                  )}
                  {customer.email && (
                    <span className="flex items-center gap-1">
                      <Mail size={16} /> {customer.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canUpdate && (
                <button onClick={() => onEdit(customer)} className={btnIcon}><Pencil size={22} /></button>
              )}
              {canDelete && (
                <button onClick={() => onDelete(customer)} className={btnDanger}><Trash2 size={22} /></button>
              )}
            </div>
          </li>
        ))}
      </ul>
    )}

    {(next || prev) && (
      <div className="flex items-center justify-between mt-6">
        <p className="text-muted text-base">{count} client(s) au total</p>
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

export default CustomerList;
