import {
  Search, ChevronLeft, ChevronRight, Package, Pencil, XCircle,
} from 'lucide-react';
import Loader from '../../../contexts/Loader';
import { TYPE_LABELS, TYPE_STYLES, btnSecondary, btnIcon, btnDanger } from './constants';

const StockMovementList = ({
  movements, loading, search, page, count, next, prev,
  onSearchChange, onPageChange, onEdit, onDelete, canEdit,
}) => (
  <>
    <div className="relative mb-4">
      <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Rechercher un mouvement..."
        className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>

    {loading ? (
      <Loader fullscreen={false} />
    ) : movements.length === 0 ? (
      <p className="text-muted text-lg">Aucun mouvement de stock pour le moment.</p>
    ) : (
      <ul className="divide-y divide-border bg-surface rounded-2xl border border-border">
        {movements.map((m) => (
          <li key={m.uuid} className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Package size={24} className="text-primary-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">
                  {m.product?.name || 'Produit supprimé'}
                </p>
                <p className="text-base text-muted">
                  {m.store?.name || '—'} — {new Date(m.created_at).toLocaleDateString('fr-FR')}
                </p>
                {m.note && (
                  <p className="text-sm text-primary-600 font-medium mt-0.5">{m.note}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${TYPE_STYLES[m.type] || 'bg-gray-100 text-gray-600'}`}>
                {TYPE_LABELS[m.type] || m.type}
              </span>
              <span className={`text-lg font-bold ${m.type === 'in' ? 'text-green-600' : m.type === 'out' ? 'text-red-600' : 'text-orange-600'}`}>
                {m.type === 'in' ? '+' : m.type === 'out' ? '-' : '='}{m.quantity}
              </span>
              {canEdit && onEdit && (
                <button onClick={() => onEdit(m)} className={btnIcon}><Pencil size={18} /></button>
              )}
              {canEdit && onDelete && (
                <button onClick={() => onDelete(m)}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium transition-colors">
                  <XCircle size={16} />
                  Annuler
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    )}

    {(next || prev) && (
      <div className="flex items-center justify-between mt-6">
        <p className="text-muted text-base">{count} mouvement(s) au total</p>
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

export default StockMovementList;
