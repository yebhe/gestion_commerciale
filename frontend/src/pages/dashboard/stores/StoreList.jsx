import {
  Store as StoreIcon, Pencil, Trash2, MapPin, Phone,
  Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Loader from '../../../contexts/Loader';
import { mediaUrl } from '../../../lib/api';
import { btnSecondary, btnIcon, btnDanger } from './constants';

const StoreList = ({
  stores, loading, search, page, count, next, prev,
  canUpdate, canDelete, isCompanyScope, assignedStore,
  onSearchChange, onPageChange, onEdit, onDelete,
}) => (
  <>
    {!isCompanyScope && assignedStore && (
      <div className="bg-primary-50 border border-primary-200 rounded-2xl p-5 mb-6">
        <p className="text-base text-muted">
          Vous êtes assigné au magasin <span className="font-semibold text-foreground">{assignedStore.name}</span>.
          Vous pouvez consulter et modifier les informations de votre magasin uniquement.
        </p>
      </div>
    )}

    <div className="relative mb-4">
      <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Rechercher un magasin..."
        className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>

    {loading ? (
      <Loader fullscreen={false} />
    ) : stores.length === 0 ? (
      <div className="bg-primary-50 border border-primary-200 rounded-2xl p-8 text-center">
        <StoreIcon size={40} className="text-primary-400 mx-auto mb-3" />
        <p className="text-lg text-muted">Aucun magasin pour le moment.</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {stores.map((store) => (
          <div key={store.uuid} className="bg-surface rounded-2xl border border-border p-5 flex flex-col">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {store.logo ? (
                  <img src={mediaUrl(store.logo)} alt={store.name} className="w-full h-full object-cover" />
                ) : (
                  <StoreIcon size={30} className="text-primary-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground text-lg truncate">{store.name}</p>
              </div>
            </div>

            <div className="space-y-2 flex-1">
              {store.address && (
                <div className="flex items-center gap-2 text-base text-muted">
                  <MapPin size={18} className="flex-shrink-0 text-primary-500" />
                  <span className="truncate">{store.address}</span>
                </div>
              )}
              {store.phone && (
                <div className="flex items-center gap-2 text-base text-muted">
                  <Phone size={18} className="flex-shrink-0 text-primary-500" />
                  <span>{store.phone}</span>
                </div>
              )}
              {!store.address && !store.phone && (
                <p className="text-base text-muted italic">Aucune information supplémentaire</p>
              )}
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              {canUpdate && (
                <button onClick={() => onEdit(store)} className={btnIcon}><Pencil size={22} /></button>
              )}
              {canDelete && isCompanyScope && (
                <button onClick={() => onDelete(store)} className={btnDanger}><Trash2 size={22} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    )}

    {(next || prev) && (
      <div className="flex items-center justify-between mt-6">
        <p className="text-muted text-base">{count} magasin(s) au total</p>
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

export default StoreList;
