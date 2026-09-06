import {
  Tags, Plus, Pencil, Trash2, Search, Store,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import Loader from '../../../contexts/Loader';
import { btnPrimary, btnSecondary, btnIcon, btnDanger } from './constants';

const CategoryList = ({
  categories, loading, search, page, count, next, prev,
  isCompanyScope, selectedStoreUuid,
  canCreate, canUpdate, canDelete,
  onSearchChange, onPageChange, onEdit, onDelete, onCreate,
}) => (
  <>
    {!(isCompanyScope && !selectedStoreUuid) && (
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted text-lg">{count} catégorie(s)</p>
        {canCreate && (
          <button type="button" onClick={onCreate}
            disabled={isCompanyScope && !selectedStoreUuid}
            className={`${btnPrimary} ${isCompanyScope && !selectedStoreUuid ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <Tags size={24} />
            Ajouter une catégorie
          </button>
        )}
      </div>
    )}

    {!(isCompanyScope && !selectedStoreUuid) && (
      <div className="relative mb-4">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher une catégorie..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    )}

    {loading ? (
      <Loader fullscreen={false} />
    ) : isCompanyScope && !selectedStoreUuid ? (
      <div className="bg-primary-50 border border-primary-200 rounded-2xl p-8 text-center">
        <Store size={40} className="text-primary-400 mx-auto mb-3" />
        <p className="text-lg text-muted">Veuillez sélectionner un magasin pour voir les catégories.</p>
      </div>
    ) : categories.length === 0 ? (
      <p className="text-muted text-lg">Aucune catégorie pour le moment.</p>
    ) : (
      <ul className="divide-y divide-border bg-surface rounded-2xl border border-border">
        {categories.map((category) => (
          <li key={category.uuid} className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-4">
              <Tags size={26} className="text-primary-600" />
              <div>
                <p className="font-semibold text-foreground text-lg">{category.name}</p>
                <p className="text-base text-muted">{category.store ? category.store.name : 'Partagée'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canUpdate && (
                <button onClick={() => onEdit(category)} className={btnIcon}><Pencil size={22} /></button>
              )}
              {canDelete && (
                <button onClick={() => onDelete(category)} className={btnDanger}><Trash2 size={22} /></button>
              )}
            </div>
          </li>
        ))}
      </ul>
    )}

    {(next || prev) && (
      <div className="flex items-center justify-between mt-6">
        <p className="text-muted text-base">{count} catégorie(s) au total</p>
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

export default CategoryList;
