import { useEffect, useState, useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { productsAPI, categoriesAPI, storesAPI } from '../../../lib/api';
import { useOfflineMutation } from '../../../pwa/useOfflineMutation';
import { useSyncRefresh } from '../../../pwa';
import { applyPendingStock } from '../../../pwa/applyPendingStock';
import { useAuth } from '../../../contexts/AuthContext';
import { usePWA } from '../../../pwa/PWAContext';
import db from '../../../pwa/db';
import networkManager from '../../../pwa/networkManager';
import { loadStoresWithCache } from '../../../pwa/preloadCache';
import { consumePendingSearch } from '../../../lib/pendingSearch';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import AlertDialog from '../../../components/ui/AlertDialog';
import {
  EMPTY_PRODUCT, EMPTY_CATEGORY, validateProductStep,
} from './constants';
import StoreSelector from './StoreSelector';
import ProductForm from './ProductForm';
import ProductList from './ProductList';
import CategoryForm from './CategoryForm';
import CategoryList from './CategoryList';

const ProductsModule = ({ sub, onBack }) => {
  const PAGE_SIZE = 10;
  const { user, hasPermission, scope, assignedStore } = useAuth();
  const isNewProduct = sub === 'new-product';
  const isCategories = sub === 'categories';
  const [tab, setTab] = useState(isCategories ? 'categories' : 'products');
  const isCompanyScope = scope === 'COMPANY';

  const [stores, setStores] = useState([]);
  const [selectedStoreUuid, setSelectedStoreUuid] = useState(
    !isCompanyScope && assignedStore ? assignedStore.uuid : ''
  );
  const [storeError, setStoreError] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prodPage, setProdPage] = useState(1);
  const [prodCount, setProdCount] = useState(0);
  const [prodNext, setProdNext] = useState(null);
  const [prodPrev, setProdPrev] = useState(null);
  const [catPage, setCatPage] = useState(1);
  const [catCount, setCatCount] = useState(0);
  const [catNext, setCatNext] = useState(null);
  const [catPrev, setCatPrev] = useState(null);
  const [prodSearch, setProdSearch] = useState('');
  const [prodSearchDebounced, setProdSearchDebounced] = useState('');
  const [catSearch, setCatSearch] = useState('');
  const [catSearchDebounced, setCatSearchDebounced] = useState('');
  const [showProductForm, setShowProductForm] = useState(isNewProduct);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [productImage, setProductImage] = useState(null);
  const [productStep, setProductStep] = useState(0);
  const [stepErrors, setStepErrors] = useState({});
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY);
  const [categoryError, setCategoryError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });
  const { mutate: createCategory } = useOfflineMutation('categories', 'CREATE');
  const { mutate: updateCategory } = useOfflineMutation('categories', 'UPDATE');
  const { mutate: deleteCategory } = useOfflineMutation('categories', 'DELETE');
  const { mutate: createProduct } = useOfflineMutation('products', 'CREATE');
  const { mutate: updateProduct } = useOfflineMutation('products', 'UPDATE');
  const { mutate: deleteProduct } = useOfflineMutation('products', 'DELETE');
  const { online } = usePWA();
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const pending = consumePendingSearch('products');
    if (pending) setProdSearch(pending);
  }, []);

  const showAlert = useCallback((type, title, message = '') => setAlert({ type, title, message }), []);
  const closeAlert = useCallback(() => setAlert(null), []);
  const closeConfirm = () => setConfirm({ ...confirm, open: false });

  const canProductCreate = hasPermission('products.create');
  const canProductUpdate = hasPermission('products.update');
  const canChangePrice = hasPermission('products.change_price');
  const canProductEdit = canProductUpdate || canChangePrice;
  const priceOnlyEdit = !canProductUpdate && canChangePrice;
  const canProductDelete = hasPermission('products.delete');
  const canCategoryCreate = hasPermission('categories.create');
  const canCategoryUpdate = hasPermission('categories.update');
  const canCategoryDelete = hasPermission('categories.delete');

  const loadStores = async () => {
    try {
      const all = await loadStoresWithCache();
      setStores(all);
      if (!all.length) setStoreError('Impossible de charger la liste des magasins.');
    } catch { setStoreError('Impossible de charger la liste des magasins.'); }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const storeParam = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
      if (!storeParam) {
        setProducts([]); setCategories([]);
        setProdCount(0); setCatCount(0);
        setProdNext(null); setProdPrev(null);
        setCatNext(null); setCatPrev(null);
        return;
      }

      const companyUuid = localStorage.getItem('current_company_uuid') || '';

      // Hors ligne : lire depuis le cache local
      if (!networkManager.getState().online) {
        const cacheFilter = (items) => {
          let filtered = items.filter((i) => !i.is_deleted);
          if (storeParam) {
            filtered = filtered.filter((i) => !i.store_uuid || i.store_uuid === storeParam);
          }
          return filtered;
        };
        const [cachedProducts, cachedCategories] = await Promise.all([
          db.products.where('company_uuid').equals(companyUuid).toArray(),
          db.categories.where('company_uuid').equals(companyUuid).toArray(),
        ]);
        const prods = cacheFilter(cachedProducts).filter((p) =>
          !prodSearchDebounced ||
          (p.name || '').toLowerCase().includes(prodSearchDebounced.toLowerCase()) ||
          (p.barcode || '').includes(prodSearchDebounced)
        );
        const cats = cacheFilter(cachedCategories).filter((c) =>
          !catSearchDebounced ||
          (c.name || '').toLowerCase().includes(catSearchDebounced.toLowerCase())
        );
        const patchedProducts = await applyPendingStock(prods, storeParam);
        setProducts(patchedProducts);
        setCategories(cats);
        setProdCount(patchedProducts.length);
        setCatCount(cats.length);
        return;
      }

      // En ligne : charger toutes les pages
      const fetchAll = async (apiFn, search) => {
        const all = [];
        let p = 1;
        while (true) {
          const res = await apiFn(p, search, storeParam);
          const results = res.data.results || res.data || [];
          all.push(...results);
          if (!res.data.next) break;
          p++;
          if (p > 50) break;
        }
        return all;
      };

      const [allProducts, allCategories] = await Promise.all([
        fetchAll(productsAPI.list, prodSearchDebounced),
        fetchAll(categoriesAPI.list, catSearchDebounced),
      ]);

      const patchedProducts = await applyPendingStock(allProducts, storeParam);
      setProducts(patchedProducts);
      setCategories(allCategories);
      setProdCount(patchedProducts.length);
      setCatCount(allCategories.length);

      // Mettre en cache localement
      if (companyUuid) {
        const tag = (items) => items.map((item) => ({
          ...item,
          company_uuid: companyUuid,
          store_uuid: storeParam,
          updated_at: new Date().toISOString(),
        }));
        await Promise.all([
          db.products.bulkPut(tag(allProducts)),
          db.categories.bulkPut(tag(allCategories)),
        ]);
      }
    } catch {
      try {
        const companyUuid = localStorage.getItem('current_company_uuid') || '';
        const storeParam = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
        const cacheFilter = (items) => {
          let filtered = items.filter((i) => !i.is_deleted);
          if (storeParam) {
            filtered = filtered.filter((i) => !i.store_uuid || i.store_uuid === storeParam);
          }
          return filtered;
        };
        const [cachedProducts, cachedCategories] = await Promise.all([
          db.products.where('company_uuid').equals(companyUuid).toArray(),
          db.categories.where('company_uuid').equals(companyUuid).toArray(),
        ]);
        const prods = cacheFilter(cachedProducts).filter((p) =>
          !prodSearchDebounced ||
          (p.name || '').toLowerCase().includes(prodSearchDebounced.toLowerCase()) ||
          (p.barcode || '').includes(prodSearchDebounced)
        );
        const cats = cacheFilter(cachedCategories).filter((c) =>
          !catSearchDebounced ||
          (c.name || '').toLowerCase().includes(catSearchDebounced.toLowerCase())
        );
        const patchedProducts = await applyPendingStock(prods, storeParam);
        setProducts(patchedProducts);
        setCategories(cats);
        setProdCount(patchedProducts.length);
        setCatCount(cats.length);
      } catch (cacheErr) {
        setError('Impossible de charger les données.');
      }
    } finally {
      setLoading(false);
    }
  }, [isCompanyScope, assignedStore, selectedStoreUuid, prodSearchDebounced, catSearchDebounced, online]);

  useSyncRefresh(loadData);

  useEffect(() => {
    const t = setTimeout(() => { setProdSearchDebounced(prodSearch); setProdPage(1); }, 400);
    return () => clearTimeout(t);
  }, [prodSearch]);

  useEffect(() => {
    const t = setTimeout(() => { setCatSearchDebounced(catSearch); setCatPage(1); }, 400);
    return () => clearTimeout(t);
  }, [catSearch]);

  useEffect(() => { if (isCompanyScope) loadStores(); }, []);
  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setTab(isCategories ? 'categories' : 'products'); setShowProductForm(isNewProduct); setShowCategoryForm(false); }, [sub]);

  const storeBadge = (item) =>
    item.store ? ` — ${item.store.name}` : scope === 'STORE' && assignedStore ? ` — ${assignedStore.name}` : '';

  const displayProducts = useMemo(() => products.slice((prodPage - 1) * PAGE_SIZE, prodPage * PAGE_SIZE), [products, prodPage]);
  const displayCategories = useMemo(() => categories.slice((catPage - 1) * PAGE_SIZE, catPage * PAGE_SIZE), [categories, catPage]);
  const prodHasNext = prodPage * PAGE_SIZE < prodCount;
  const prodHasPrev = prodPage > 1;
  const catHasNext = catPage * PAGE_SIZE < catCount;
  const catHasPrev = catPage > 1;

  const closeForms = () => {
    setShowProductForm(false); setShowCategoryForm(false);
    setEditingProduct(null); setEditingCategory(null);
    setProductForm(EMPTY_PRODUCT); setCategoryForm(EMPTY_CATEGORY);
    setProductImage(null); setProductStep(0); setStepErrors({}); setCategoryError('');
  };

  const openCreateProduct = () => {
    if (isCompanyScope && !selectedStoreUuid) {
      showAlert('warning', 'Magasin requis', 'Veuillez sélectionner un magasin avant d\'ajouter un produit.'); return;
    }
    setEditingProduct(null); setProductForm(EMPTY_PRODUCT); setProductImage(null);
    setProductStep(0); setStepErrors({}); setError(''); setShowProductForm(true);
  };

  const openEditProduct = (product) => {
    setEditingProduct(product);
    const storeUuid = isCompanyScope ? selectedStoreUuid : (assignedStore?.uuid || '');
    const storeStock = product.stock_by_store?.find((s) => s.store?.uuid === storeUuid)?.quantity ?? 0;
    setProductForm({
      name: product.name || '', description: product.description || '', barcode: product.barcode || '',
      purchase_price: product.purchase_price || '', selling_price: product.selling_price || '',
      stock_quantity: storeStock, category: product.category?.uuid || '',
    });
    setProductImage(null); setProductStep(0); setStepErrors({}); setError(''); setShowProductForm(true);
  };

  const openCreateCategory = () => {
    if (isCompanyScope && !selectedStoreUuid) {
      showAlert('warning', 'Magasin requis', 'Veuillez sélectionner un magasin avant d\'ajouter une catégorie.'); return;
    }
    setEditingCategory(null); setCategoryForm(EMPTY_CATEGORY); setCategoryError(''); setShowCategoryForm(true);
  };

  const openEditCategory = (category) => {
    setEditingCategory(category); setCategoryForm({ name: category.name || '' });
    setCategoryError(''); setShowCategoryForm(true);
  };

  const nextStep = () => {
    const errors = validateProductStep(productStep, productForm);
    if (Object.keys(errors).length > 0) { setStepErrors(errors); return; }
    setStepErrors({}); setProductStep((p) => Math.min(p + 1, 4));
  };

  const prevStep = () => { setStepErrors({}); setProductStep((p) => Math.max(p - 1, 0)); };

  const appendDecimal = (data, key, value) => {
    data.append(key, value === '' || value == null ? '0' : value);
  };

  const handleProductSubmit = async () => {
    setError(''); setSubmitting(true);
    const isOffline = !online;
    const data = new FormData();
    let jsonPayload = {};
    if (editingProduct && priceOnlyEdit) {
      appendDecimal(data, 'selling_price', productForm.selling_price);
      jsonPayload = { selling_price: productForm.selling_price === '' || productForm.selling_price == null ? '0' : productForm.selling_price };
    } else {
      data.append('name', productForm.name);
      data.append('description', productForm.description || '');
      data.append('barcode', productForm.barcode || '');
      appendDecimal(data, 'purchase_price', productForm.purchase_price);
      appendDecimal(data, 'selling_price', productForm.selling_price);
      data.append('stock_quantity', productForm.stock_quantity || '0');
      if (productForm.category) data.append('category', productForm.category);
      if (selectedStoreUuid) data.append('store', selectedStoreUuid);
      if (productImage) data.append('image', productImage);
      jsonPayload = {
        name: productForm.name,
        description: productForm.description || '',
        barcode: productForm.barcode || '',
        purchase_price: productForm.purchase_price === '' || productForm.purchase_price == null ? '0' : productForm.purchase_price,
        selling_price: productForm.selling_price === '' || productForm.selling_price == null ? '0' : productForm.selling_price,
        stock_quantity: productForm.stock_quantity || '0',
        category: productForm.category || '',
        store: selectedStoreUuid || '',
      };
    }
    try {
      if (isOffline && productImage) {
        setError('Ajouter une image hors ligne n\'est pas supporté. Reconnectez-vous ou supprimez l\'image.');
        showAlert('error', 'Erreur', 'Ajouter une image hors ligne n\'est pas supporté.');
        setSubmitting(false);
        return;
      }
      const context = {
        company_uuid: localStorage.getItem('current_company_uuid'),
        store_uuid: selectedStoreUuid || assignedStore?.uuid || null,
        user_uuid: user?.uuid,
      };
      if (editingProduct) {
        await updateProduct(isOffline ? jsonPayload : data, { ...context, entity_uuid: editingProduct.uuid });
        showAlert('success', 'Produit modifié', `"${productForm.name}" a été mis à jour avec succès.`);
      } else {
        await createProduct(isOffline ? jsonPayload : data, context);
        showAlert('success', 'Produit créé', `"${productForm.name}" a été ajouté avec succès.`);
      }
      closeForms(); await loadData();
    } catch (err) {
      const msg = err.response?.data ? Object.values(err.response.data).flat().join(' ') : "Impossible d'enregistrer ce produit.";
      setError(msg); showAlert('error', 'Erreur', msg);
    } finally { setSubmitting(false); }
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) { setCategoryError('Veuillez saisir le nom de la catégorie.'); return; }
    setCategoryError(''); setSubmitting(true);
    try {
      const payload = { ...categoryForm };
      if (!editingCategory && selectedStoreUuid) payload.store = selectedStoreUuid;
      const context = {
        company_uuid: localStorage.getItem('current_company_uuid'),
        store_uuid: selectedStoreUuid || assignedStore?.uuid || null,
        user_uuid: user?.uuid,
      };
      if (editingCategory) {
        await updateCategory(categoryForm, { ...context, entity_uuid: editingCategory.uuid });
        showAlert('success', 'Catégorie modifiée', `"${categoryForm.name}" a été mise à jour avec succès.`);
      } else {
        await createCategory(payload, context);
        showAlert('success', 'Catégorie créée', `"${categoryForm.name}" a été ajoutée avec succès.`);
      }
      closeForms(); await loadData();
    } catch (err) {
      const msg = err.response?.data ? Object.values(err.response.data).flat().join(' ') : "Impossible d'enregistrer cette catégorie.";
      setCategoryError(msg); showAlert('error', 'Erreur', msg);
    } finally { setSubmitting(false); }
  };

  const handleDeleteProduct = (product) => {
    setConfirm({
      open: true, title: 'Supprimer le produit', message: `Voulez-vous vraiment supprimer "${product.name}" ?`,
      onConfirm: async () => {
        try {
          await deleteProduct(null, {
            company_uuid: localStorage.getItem('current_company_uuid'),
            store_uuid: selectedStoreUuid || assignedStore?.uuid || null,
            user_uuid: user?.uuid,
            entity_uuid: product.uuid,
          });
          setConfirm({ ...confirm, open: false });
          showAlert('success', 'Produit supprimé', `"${product.name}" a été supprimé avec succès.`);
          await loadData();
        } catch {
          setConfirm({ ...confirm, open: false });
          showAlert('error', 'Erreur', 'Impossible de supprimer ce produit.');
        }
      },
    });
  };

  const handleDeleteCategory = (category) => {
    setConfirm({
      open: true, title: 'Supprimer la catégorie', message: `Voulez-vous vraiment supprimer "${category.name}" ?`,
      onConfirm: async () => {
        try {
          await deleteCategory(null, {
            company_uuid: localStorage.getItem('current_company_uuid'),
            store_uuid: selectedStoreUuid || assignedStore?.uuid || null,
            user_uuid: user?.uuid,
            entity_uuid: category.uuid,
          });
          setConfirm({ ...confirm, open: false });
          showAlert('success', 'Catégorie supprimée', `"${category.name}" a été supprimée avec succès.`);
          await loadData();
        } catch {
          setConfirm({ ...confirm, open: false });
          showAlert('error', 'Erreur', 'Impossible de supprimer cette catégorie.');
        }
      },
    });
  };

  return (
    <div>
      <AlertDialog alert={alert} onClose={closeAlert} />

      <div className="flex items-center gap-2 mb-6 border-b border-border">
        {onBack && (
          <button type="button" onClick={onBack}
            className="mr-2 p-2.5 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
            <ArrowLeft size={24} />
          </button>
        )}
        <button type="button" onClick={() => setTab('products')}
          className={`px-5 py-3 text-base font-semibold ${tab === 'products' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-muted'}`}>
          Produits
        </button>
        <button type="button" onClick={() => setTab('categories')}
          className={`px-5 py-3 text-base font-semibold ${tab === 'categories' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-muted'}`}>
          Catégories
        </button>
      </div>

      {isCompanyScope && (
        <StoreSelector stores={stores} selectedStoreUuid={selectedStoreUuid}
          onChange={setSelectedStoreUuid} error={storeError} />
      )}

      {error && !showProductForm && !showCategoryForm && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-base mb-4">{error}</div>
      )}

      {tab === 'products' && (
        <div>
          {showProductForm ? (
            <ProductForm
              editingProduct={editingProduct} productForm={productForm}
              productStep={productStep} stepErrors={stepErrors} productImage={productImage}
              priceOnlyEdit={priceOnlyEdit} error={error} submitting={submitting}
              categories={categories} stores={stores}
              selectedStoreUuid={selectedStoreUuid} assignedStore={assignedStore}
              storeBadge={storeBadge}
              onChange={(e) => setProductForm({ ...productForm, [e.target.name]: e.target.value })}
              onImageChange={(e) => setProductImage(e.target.files?.[0] || null)}
              onNextStep={nextStep} onPrevStep={prevStep}
              onSubmit={handleProductSubmit} onClose={closeForms}
            />
          ) : (
            <ProductList
              products={displayProducts} loading={loading} search={prodSearch}
              page={prodPage} count={prodCount} next={prodHasNext} prev={prodHasPrev}
              isCompanyScope={isCompanyScope} selectedStoreUuid={selectedStoreUuid}
              canCreate={canProductCreate} canEdit={canProductEdit} canDelete={canProductDelete}
              storeBadge={storeBadge} categories={categories}
              onSearchChange={setProdSearch} onPageChange={setProdPage}
              onEdit={openEditProduct} onDelete={handleDeleteProduct} onCreate={openCreateProduct}
            />
          )}
        </div>
      )}

      {tab === 'categories' && (
        <div>
          {showCategoryForm ? (
            <CategoryForm
              editingCategory={editingCategory} categoryForm={categoryForm}
              categoryError={categoryError} submitting={submitting}
              onChange={(e) => setCategoryForm({ ...categoryForm, [e.target.name]: e.target.value })}
              onSubmit={handleCategorySubmit} onClose={closeForms}
            />
          ) : (
            <CategoryList
              categories={displayCategories} loading={loading} search={catSearch}
              page={catPage} count={catCount} next={catHasNext} prev={catHasPrev}
              isCompanyScope={isCompanyScope} selectedStoreUuid={selectedStoreUuid}
              canCreate={canCategoryCreate} canUpdate={canCategoryUpdate} canDelete={canCategoryDelete}
              onSearchChange={setCatSearch} onPageChange={setCatPage}
              onEdit={openEditCategory} onDelete={handleDeleteCategory} onCreate={openCreateCategory}
            />
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirm.open} title={confirm.title} message={confirm.message}
        onConfirm={confirm.onConfirm} onCancel={closeConfirm}
      />
    </div>
  );
};

export default ProductsModule;
