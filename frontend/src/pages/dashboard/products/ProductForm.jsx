import {
  X, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { mediaUrl } from '../../../lib/api';
import VariantsLotsPanel from './VariantsLotsPanel';
import {
  PRODUCT_STEPS, inputClass, labelClass, btnPrimary, btnSecondary,
} from './constants';

const ProductForm = ({
  editingProduct, productForm, productStep, stepErrors, productImage,
  priceOnlyEdit, error, submitting,
  categories, stores, selectedStoreUuid, assignedStore,
  storeBadge,
  onChange, onImageChange, onNextStep, onPrevStep, onSubmit, onClose,
}) => (
  <div className="bg-surface rounded-2xl border border-border p-6 mb-6 relative">
    <button type="button" onClick={onClose}
      className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
      <X size={24} />
    </button>
    <h2 className="text-xl font-bold text-foreground mb-2">
      {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
    </h2>

    {priceOnlyEdit && (
      <p className="text-base text-orange-600 mb-4">Vous pouvez uniquement modifier le prix de vente.</p>
    )}

    {!priceOnlyEdit && (
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {PRODUCT_STEPS.map((s, idx) => {
          const StepIcon = s.icon;
          return (
            <div key={s.key} className="flex items-center gap-2 flex-shrink-0">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${productStep === idx ? 'bg-primary-600 text-white' : productStep > idx ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-muted'}`}>
                <StepIcon size={20} />
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              {idx < PRODUCT_STEPS.length - 1 && <ChevronRight size={18} className="text-muted flex-shrink-0" />}
            </div>
          );
        })}
      </div>
    )}

    {error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base mb-4">{error}</div>
    )}

    {priceOnlyEdit ? (
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Prix de vente</label>
          <input name="selling_price" type="number" step="0.01" min="0"
            value={productForm.selling_price} onChange={onChange} className={inputClass} />
        </div>
        <button onClick={onSubmit} disabled={submitting} className={btnPrimary}>
          {submitting ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    ) : (
      <div className="space-y-6">
        {productStep === 0 && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Nom du produit</label>
              <input name="name" value={productForm.name} onChange={onChange} className={inputClass} placeholder="Ex: Coca-Cola 1L" />
              {stepErrors.name && <p className="text-base text-red-600 mt-1">{stepErrors.name}</p>}
            </div>
            <div>
              <label className={labelClass}>Code-barres</label>
              <input name="barcode" value={productForm.barcode} onChange={onChange} className={inputClass} placeholder="Ex: 1234567890123" />
            </div>
            <div>
              <label className={labelClass}>Catégorie</label>
              <select name="category" value={productForm.category} onChange={onChange} className={inputClass}>
                <option value="">— Aucune —</option>
                {categories.map((c) => (
                  <option key={c.uuid} value={c.uuid}>{c.name}{storeBadge(c)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea name="description" value={productForm.description} onChange={onChange} rows="3" className={inputClass} placeholder="Description optionnelle" />
            </div>
          </div>
        )}

        {productStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Prix d'achat (FCFA)</label>
              <input name="purchase_price" type="number" step="0.01" min="0" value={productForm.purchase_price} onChange={onChange} className={inputClass} placeholder="Ex: 500" />
              {stepErrors.purchase_price && <p className="text-base text-red-600 mt-1">{stepErrors.purchase_price}</p>}
            </div>
            <div>
              <label className={labelClass}>Prix de vente (FCFA)</label>
              <input name="selling_price" type="number" step="0.01" min="0" value={productForm.selling_price} onChange={onChange} className={inputClass} placeholder="Ex: 700" />
              {stepErrors.selling_price && <p className="text-base text-red-600 mt-1">{stepErrors.selling_price}</p>}
            </div>
          </div>
        )}

        {productStep === 2 && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Quantité en stock</label>
              <input name="stock_quantity" type="number" min="0" value={productForm.stock_quantity} onChange={onChange} className={inputClass} placeholder="Ex: 100" />
              {stepErrors.stock_quantity && <p className="text-base text-red-600 mt-1">{stepErrors.stock_quantity}</p>}
            </div>
          </div>
        )}

        {productStep === 3 && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Image du produit</label>
              <input type="file" accept="image/*" onChange={onImageChange} className="w-full text-base text-muted" />
              {productImage && (
                <p className="text-base text-green-600 mt-2">Nouvelle image sélectionnée : {productImage.name}</p>
              )}
              {editingProduct?.image && !productImage && (
                <img src={mediaUrl(editingProduct.image)} alt="Aperçu" className="mt-3 h-28 w-28 rounded-xl object-cover border border-border" />
              )}
            </div>
          </div>
        )}

        {productStep === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Vérifiez les informations</h3>
            <div className="bg-gray-50 rounded-xl p-5 space-y-2 text-base">
              <p><span className="font-semibold">Nom :</span> {productForm.name || '—'}</p>
              <p><span className="font-semibold">Code-barres :</span> {productForm.barcode || '—'}</p>
              <p><span className="font-semibold">Prix d'achat :</span> {productForm.purchase_price || '0'} FCFA</p>
              <p><span className="font-semibold">Prix de vente :</span> {productForm.selling_price || '0'} FCFA</p>
              <p><span className="font-semibold">Stock :</span> {productForm.stock_quantity || '0'}</p>
              <p><span className="font-semibold">Catégorie :</span> {categories.find(c => c.uuid === productForm.category)?.name || 'Aucune'}</p>
              <p><span className="font-semibold">Magasin :</span> {stores.find(s => s.uuid === selectedStoreUuid)?.name || (assignedStore?.name || '—')}</p>
              <p><span className="font-semibold">Image :</span> {productImage ? productImage.name : (editingProduct?.image ? 'Image existante' : 'Aucune')}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <button type="button" onClick={onPrevStep} disabled={productStep === 0}
            className={`${btnSecondary} ${productStep === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <ChevronLeft size={24} />
            Précédent
          </button>
          {productStep < PRODUCT_STEPS.length - 1 ? (
            <button type="button" onClick={onNextStep} className={btnPrimary}>
              Suivant
              <ChevronRight size={24} />
            </button>
          ) : (
            <button type="button" onClick={onSubmit} disabled={submitting}
              className={`${btnPrimary} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {submitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>
    )}

    {/* Variantes / lots : uniquement sur un produit existant (routes
        imbriquées /products/{uuid}/variants|lots — étape 4.5). */}
    {editingProduct && (
      <VariantsLotsPanel productUuid={editingProduct.uuid} />
    )}
  </div>
);

export default ProductForm;
