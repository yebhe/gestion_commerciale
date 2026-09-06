import {
  Package, Plus, Pencil, Trash2, Search, Store,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import Loader from '../../../contexts/Loader';
import { mediaUrl } from '../../../lib/api';
import { btnPrimary, btnSecondary, btnIcon, btnDanger } from './constants';

const ProductList = ({
  products, loading, search, page, count, next, prev,
  isCompanyScope, selectedStoreUuid,
  canCreate, canEdit, canDelete,
  storeBadge, categories,
  onSearchChange, onPageChange, onEdit, onDelete, onCreate,
}) => {
  const categoryByUuid = (categories || []).reduce((acc, c) => { acc[c.uuid] = c; return acc; }, {});
  const storeStock = (p) => {
    if (!selectedStoreUuid) return p.stock_quantity;
    return p.stock_by_store?.find((s) => s.store?.uuid === selectedStoreUuid)?.quantity ?? 0;
  };
  return (
  <>
    {!(isCompanyScope && !selectedStoreUuid) && (
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted text-lg">{count} produit(s)</p>
        {canCreate && (
          <button type="button" onClick={onCreate}
            disabled={isCompanyScope && !selectedStoreUuid}
            className={`${btnPrimary} ${isCompanyScope && !selectedStoreUuid ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <Plus size={24} />
            Ajouter un produit
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
          placeholder="Rechercher un produit..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    )}

    {loading ? (
      <Loader fullscreen={false} />
    ) : isCompanyScope && !selectedStoreUuid ? (
      <div className="bg-primary-50 border border-primary-200 rounded-2xl p-8 text-center">
        <Store size={40} className="text-primary-400 mx-auto mb-3" />
        <p className="text-lg text-muted">Veuillez sélectionner un magasin pour voir les produits.</p>
      </div>
    ) : products.length === 0 ? (
      <p className="text-muted text-lg">Aucun produit pour le moment.</p>
    ) : (
      <ul className="divide-y divide-border bg-surface rounded-2xl border border-border">
        {products.map((product) => (
          <li key={product.uuid} className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {product.image ? (
                  <img src={mediaUrl(product.image)} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <Package size={26} className="text-primary-600" />
                )}
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">{product.name}</p>
                <p className="text-base text-muted">
                  {product.selling_price} FCFA — Stock: {storeStock(product)}
                  {(() => {
                    if (!product.category) return null;
                    const name = typeof product.category === 'object'
                      ? product.category?.name
                      : categoryByUuid[product.category]?.name;
                    return name ? ` — ${name}` : null;
                  })()}
                  {storeBadge(product)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button onClick={() => onEdit(product)} className={btnIcon}><Pencil size={22} /></button>
              )}
              {canDelete && (
                <button onClick={() => onDelete(product)} className={btnDanger}><Trash2 size={22} /></button>
              )}
            </div>
          </li>
        ))}
      </ul>
    )}

    {(next || prev) && (
      <div className="flex items-center justify-between mt-6">
        <p className="text-muted text-base">{count} produit(s) au total</p>
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
};

export default ProductList;
