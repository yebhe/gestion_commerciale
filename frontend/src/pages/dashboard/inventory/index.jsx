import { useEffect, useState, useCallback, useMemo } from 'react';
import { ArrowLeft, PackagePlus, ArrowLeftRight, History, SlidersHorizontal, Boxes } from 'lucide-react';
import api, { inventoryAPI, productsAPI, storesAPI } from '../../../lib/api';
import db from '../../../pwa/db';
import networkManager from '../../../pwa/networkManager';
import { loadStoresWithCache } from '../../../pwa/preloadCache';
import { usePWA } from '../../../pwa/PWAContext';
import { useOfflineMutation } from '../../../pwa/useOfflineMutation';
import { useSyncRefresh } from '../../../pwa';
import { applyPendingStock } from '../../../pwa/applyPendingStock';
import { useAuth } from '../../../contexts/AuthContext';
import AlertDialog from '../../../components/ui/AlertDialog';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { EMPTY_ENTRY, EMPTY_ADJUST, EMPTY_TRANSFER, btnPrimary } from './constants';
import StoreSelector from './StoreSelector';
import StockEntryForm from './StockEntryForm';
import StockAdjustForm from './StockAdjustForm';
import StockTransferForm from './StockTransferForm';
import StockMovementList from './StockMovementList';
import StockAvailabilityView from './StockAvailabilityView';

const TABS = [
  { key: 'stock-availability', label: 'Stock disponible', icon: Boxes },
  { key: 'stock-entry', label: 'Entrée de stock', icon: PackagePlus },
  { key: 'stock-adjust', label: 'Ajustement', icon: SlidersHorizontal },
  { key: 'stock-transfer', label: 'Transfert', icon: ArrowLeftRight },
  { key: 'stock-history', label: 'Historique', icon: History },
];

const PAGE_SIZE = 10;

const InventoryModule = ({ sub, onBack }) => {
  const { user, hasPermission, scope, assignedStore } = useAuth();
  const { online } = usePWA();
  const isCompanyScope = scope === 'COMPANY';
  const [tab, setTab] = useState(sub || 'stock-entry');

  const [stores, setStores] = useState([]);
  const [selectedStoreUuid, setSelectedStoreUuid] = useState(
    !isCompanyScope && assignedStore ? assignedStore.uuid : ''
  );
  const [storeError, setStoreError] = useState('');
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [prev, setPrev] = useState(null);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY);
  const [adjustForm, setAdjustForm] = useState(EMPTY_ADJUST);
  const [transferForm, setTransferForm] = useState(EMPTY_TRANSFER);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });
  const { mutate: createStockMovement } = useOfflineMutation('stock', 'CREATE');
  const { mutate: createTransfer } = useOfflineMutation('stockTransfer', 'CREATE');
  const { mutate: deleteStockMovement } = useOfflineMutation('stock', 'DELETE');

  const showAlert = useCallback((type, title, message = '') => setAlert({ type, title, message }), []);
  const closeAlert = useCallback(() => setAlert(null), []);
  const closeConfirm = () => setConfirm({ ...confirm, open: false });

  const canStockEntry = hasPermission('inventory.stock_entry');
  const canAdjust = hasPermission('inventory.adjust');
  const canTransfer = hasPermission('inventory.stock_transfer');
  const canViewHistory = hasPermission('inventory.view_history');
  const canViewAvailability = canStockEntry || canAdjust || canTransfer || canViewHistory || true;

  const fromStoreUuid = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
  const selectedStoreName = isCompanyScope
    ? stores.find((s) => s.uuid === selectedStoreUuid)?.name || ''
    : assignedStore?.name || '';

  const loadStores = async () => {
    try {
      const all = await loadStoresWithCache();
      setStores(all);
      if (!all.length) setStoreError('Impossible de charger la liste des magasins.');
    } catch { setStoreError('Impossible de charger la liste des magasins.'); }
  };

  const loadProducts = useCallback(async () => {
    const storeParam = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
    const companyUuid = localStorage.getItem('current_company_uuid') || '';
    try {
      if (!networkManager.getState().online) throw new Error('offline');
      let all = [];
      let p = 1;
      let hasMore = true;
      while (hasMore) {
        const res = await api.get('/products/', { params: { page: p, ...(storeParam && { store: storeParam }) } });
        const pageData = res.data.results || res.data || [];
        all = all.concat(pageData);
        hasMore = !!res.data.next;
        p++;
        if (p > 50) break;
      }
      setProducts(await applyPendingStock(all, storeParam));
    } catch {
      const cached = await db.products.where('company_uuid').equals(companyUuid).toArray();
      let all = cached.filter((p) => !p.is_deleted);
      if (storeParam) all = all.filter((p) => !p.store_uuid || p.store_uuid === storeParam);
      setProducts(await applyPendingStock(all, storeParam));
    }
  }, [isCompanyScope, selectedStoreUuid, assignedStore]);

  const isTransferItem = (m) => !!m.is_transfer || (!!m.from_store && !!m.to_store);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    try {
      const storeParam = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
      const companyUuid = localStorage.getItem('current_company_uuid') || '';
      const searchLower = searchDebounced.toLowerCase();

      if (!networkManager.getState().online) {
        let cached = await db.stockMovements.where('company_uuid').equals(companyUuid).toArray();
        if (storeParam) cached = cached.filter((m) => m.store_uuid === storeParam || m.store === storeParam);
        cached = cached.filter((m) => !m.is_deleted);
        if (tab === 'stock-entry') {
          cached = cached.filter((m) => m.type === 'in' && !isTransferItem(m));
        } else if (tab === 'stock-adjust') {
          cached = cached.filter((m) => m.type === 'adjustment' && !isTransferItem(m));
        } else if (tab === 'stock-transfer') {
          cached = cached.filter((m) => isTransferItem(m));
        }
        if (searchDebounced) {
          cached = cached.filter((m) =>
            (m.product?.name || '').toLowerCase().includes(searchLower) ||
            (m.note || '').toLowerCase().includes(searchLower)
          );
        }
        setMovements(cached);
        setCount(cached.length);
        setNext(null);
        setPrev(null);
        setLoading(false);
        return;
      }

      const params = { ...(searchDebounced && { search: searchDebounced }), ...(storeParam && { store: storeParam }) };
      if (tab === 'stock-entry') {
        params.type = 'in';
        params.is_transfer = 'false';
      } else if (tab === 'stock-adjust') {
        params.type = 'adjustment';
      } else if (tab === 'stock-transfer') {
        params.is_transfer = 'true';
      }

      const all = [];
      let p = 1;
      while (true) {
        const res = await api.get('/inventory/', { params: { ...params, page: p } });
        const results = res.data.results || res.data || [];
        all.push(...results);
        if (!res.data.next) break;
        p++;
        if (p > 50) break;
      }

      setMovements(all);
      setCount(all.length);

      if (companyUuid) {
        const tag = (items) => items.map((item) => ({
          ...item,
          company_uuid: companyUuid,
          store_uuid: storeParam || item.store || '',
          user_uuid: user?.uuid,
          movement_type: item.type || item.movement_type || null,
          is_transfer: !!item.is_transfer || (!!item.from_store && !!item.to_store),
          updated_at: new Date().toISOString(),
        }));
        await db.stockMovements.bulkPut(tag(all));
      }
    } catch {
      try {
        const companyUuid = localStorage.getItem('current_company_uuid') || '';
        const storeParam = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
        let cached = await db.stockMovements.where('company_uuid').equals(companyUuid).toArray();
        if (storeParam) cached = cached.filter((m) => m.store_uuid === storeParam || m.store === storeParam);
        cached = cached.filter((m) => !m.is_deleted);
        if (tab === 'stock-entry') {
          cached = cached.filter((m) => m.type === 'in' && !isTransferItem(m));
        } else if (tab === 'stock-adjust') {
          cached = cached.filter((m) => m.type === 'adjustment' && !isTransferItem(m));
        } else if (tab === 'stock-transfer') {
          cached = cached.filter((m) => isTransferItem(m));
        }
        if (searchDebounced) {
          const searchLower = searchDebounced.toLowerCase();
          cached = cached.filter((m) =>
            (m.product?.name || '').toLowerCase().includes(searchLower) ||
            (m.note || '').toLowerCase().includes(searchLower)
          );
        }
        setMovements(cached);
        setCount(cached.length);
        setNext(null);
        setPrev(null);
      } catch (cacheErr) {
        setError('Impossible de charger l\'historique.');
      }
    }
    finally { setLoading(false); }
  }, [isCompanyScope, selectedStoreUuid, assignedStore, searchDebounced, tab, online, user]);

  useSyncRefresh(() => { loadProducts(); loadMovements(); });

  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { if (isCompanyScope) loadStores(); }, []);
  useEffect(() => { loadProducts(); }, [selectedStoreUuid]);
  useEffect(() => { loadMovements(); }, [loadMovements]);
  useEffect(() => { setTab(sub || 'stock-entry'); setShowForm(false); }, [sub]);

  const displayMovements = useMemo(() => movements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [movements, page]);
  const hasNext = page * PAGE_SIZE < count;
  const hasPrev = page > 1;

  const closeForm = () => {
    setShowForm(false);
    setEntryForm(EMPTY_ENTRY);
    setAdjustForm(EMPTY_ADJUST);
    setTransferForm(EMPTY_TRANSFER);
    setError('');
  };

  const openForm = () => {
    if (isCompanyScope && !selectedStoreUuid) {
      showAlert('warning', 'Magasin requis', 'Veuillez sélectionner un magasin.');
      return;
    }
    setError('');
    setShowForm(true);
  };

  const handleEntrySubmit = async () => {
    if (!entryForm.product || !entryForm.quantity) {
      setError('Veuillez sélectionner un produit et une quantité.'); return;
    }
    if (parseInt(entryForm.quantity) <= 0) {
      setError('La quantité doit être supérieure à 0.'); return;
    }
    setSubmitting(true);
    try {
      const payload = {
        product: entryForm.product,
        quantity: parseInt(entryForm.quantity),
        type: 'in',
        store: selectedStoreUuid || undefined,
      };
      await createStockMovement(payload, {
        company_uuid: localStorage.getItem('current_company_uuid'),
        store_uuid: selectedStoreUuid || assignedStore?.uuid || null,
        user_uuid: user?.uuid,
      });
      showAlert('success', 'Entrée enregistrée', 'Le stock a été augmenté.');
      closeForm(); await loadMovements(); await loadProducts();
    } catch (err) {
      const msg = err.response?.data ? Object.values(err.response.data).flat().join(' ') : 'Erreur lors de l\'entrée.';
      setError(msg); showAlert('error', 'Erreur', msg);
    } finally { setSubmitting(false); }
  };

  const handleAdjustSubmit = async () => {
    if (!adjustForm.product || adjustForm.quantity === '') {
      setError('Veuillez sélectionner un produit et une quantité.'); return;
    }
    if (parseInt(adjustForm.quantity) < 0) {
      setError('La quantité ne peut pas être négative.'); return;
    }
    setSubmitting(true);
    try {
      const payload = {
        product: adjustForm.product,
        new_quantity: parseInt(adjustForm.quantity),
        type: 'adjustment',
        store: selectedStoreUuid || undefined,
      };
      await createStockMovement(payload, {
        company_uuid: localStorage.getItem('current_company_uuid'),
        store_uuid: selectedStoreUuid || assignedStore?.uuid || null,
        user_uuid: user?.uuid,
      });
      showAlert('success', 'Ajustement enregistré', 'Le stock a été ajusté.');
      closeForm(); await loadMovements(); await loadProducts();
    } catch (err) {
      const msg = err.response?.data ? Object.values(err.response.data).flat().join(' ') : 'Erreur lors de l\'ajustement.';
      setError(msg); showAlert('error', 'Erreur', msg);
    } finally { setSubmitting(false); }
  };

  const handleTransferSubmit = async () => {
    const fromStore = fromStoreUuid || transferForm.from_store;
    if (!transferForm.product || !transferForm.quantity || !fromStore || !transferForm.to_store) {
      setError('Veuillez remplir tous les champs.'); return;
    }
    if (fromStore === transferForm.to_store) {
      setError('Les magasins source et destination doivent être différents.'); return;
    }
    const transferQty = parseInt(transferForm.quantity);
    if (transferQty <= 0) {
      setError('La quantité à transférer doit être supérieure à 0.'); return;
    }
    const product = products.find((p) => p.uuid === transferForm.product);
    const sourceStock = product?.stock_by_store?.find((s) => s.store?.uuid === fromStore)?.quantity ?? 0;
    if (transferQty > sourceStock) {
      setError(`Stock insuffisant dans le magasin source : ${sourceStock} disponible(s), ${transferQty} demandé(s).`);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        product: transferForm.product,
        quantity: parseInt(transferForm.quantity),
        from_store: fromStore,
        to_store: transferForm.to_store,
      };
      await createTransfer(payload, {
        company_uuid: localStorage.getItem('current_company_uuid'),
        store_uuid: selectedStoreUuid || assignedStore?.uuid || null,
        user_uuid: user?.uuid,
      });
      showAlert('success', 'Transfert enregistré', 'Le stock a été transféré entre les magasins.');
      closeForm(); await loadMovements(); await loadProducts();
    } catch (err) {
      const msg = err.response?.data ? Object.values(err.response.data).flat().join(' ') : 'Erreur lors du transfert.';
      setError(msg); showAlert('error', 'Erreur', msg);
    } finally { setSubmitting(false); }
  };

  const handleDeleteMovement = (movement) => {
    setConfirm({
      open: true, title: 'Annuler le mouvement',
      message: `Voulez-vous vraiment annuler ce mouvement (${movement.product?.name || ''} — ${movement.quantity}) ? Le stock sera ajusté en conséquence.`,
      onConfirm: async () => {
        try {
          await deleteStockMovement(null, {
            company_uuid: localStorage.getItem('current_company_uuid'),
            store_uuid: selectedStoreUuid || assignedStore?.uuid || null,
            user_uuid: user?.uuid,
            entity_uuid: movement.uuid,
          });
          setConfirm({ ...confirm, open: false });
          showAlert('success', 'Mouvement annulé', 'Le stock a été ajusté.');
          await loadMovements(); await loadProducts();
        } catch {
          setConfirm({ ...confirm, open: false });
          showAlert('error', 'Erreur', 'Impossible d\'annuler ce mouvement.');
        }
      },
    });
  };

  const tabsFiltered = TABS.filter((t) => {
    if (t.key === 'stock-availability') return canViewAvailability;
    if (t.key === 'stock-entry') return canStockEntry || canAdjust;
    if (t.key === 'stock-adjust') return canAdjust;
    if (t.key === 'stock-transfer') return canTransfer;
    if (t.key === 'stock-history') return canViewHistory;
    return true;
  });

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
        {tabsFiltered.map((t) => {
          const TabIcon = t.icon;
          return (
            <button key={t.key} type="button" onClick={() => { setTab(t.key); setShowForm(false); }}
              className={`px-5 py-3 text-base font-semibold ${tab === t.key ? 'border-b-2 border-primary-600 text-primary-600' : 'text-muted'}`}>
              <TabIcon size={20} className="inline mr-1" />
              {t.label}
            </button>
          );
        })}
      </div>

      {isCompanyScope && (
        <StoreSelector stores={stores} selectedStoreUuid={selectedStoreUuid}
          onChange={setSelectedStoreUuid} error={storeError} />
      )}

      {tab === 'stock-availability' && (
        <StockAvailabilityView
          products={products}
          storeUuid={fromStoreUuid}
          storeName={selectedStoreName}
          loading={loading}
        />
      )}

      {tab === 'stock-entry' && (
        <div>
          {showForm ? (
            <StockEntryForm
              form={entryForm} products={products} error={error} submitting={submitting}
              storeUuid={isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '')}
              onChange={(e) => setEntryForm({ ...entryForm, [e.target.name]: e.target.value })}
              onSubmit={handleEntrySubmit} onClose={closeForm}
            />
          ) : (
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted text-lg">Entrées de stock</p>
              {canStockEntry && (
                <button type="button" onClick={openForm}
                  disabled={isCompanyScope && !selectedStoreUuid}
                  className={`${btnPrimary} ${isCompanyScope && !selectedStoreUuid ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <PackagePlus size={24} />
                  Nouvelle entrée
                </button>
              )}
            </div>
          )}
          {!showForm && (
            <StockMovementList
              movements={displayMovements}
              loading={loading} search={search} page={page}
              count={count} next={hasNext} prev={hasPrev}
              onSearchChange={setSearch} onPageChange={setPage}
              onDelete={canAdjust ? handleDeleteMovement : undefined}
              canEdit={canAdjust}
            />
          )}
        </div>
      )}

      {tab === 'stock-adjust' && (
        <div>
          {showForm ? (
            <StockAdjustForm
              form={adjustForm} products={products} error={error} submitting={submitting}
              storeUuid={isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '')}
              onChange={(e) => setAdjustForm({ ...adjustForm, [e.target.name]: e.target.value })}
              onSubmit={handleAdjustSubmit} onClose={closeForm}
            />
          ) : (
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted text-lg">Ajustements de stock</p>
              {canAdjust && (
                <button type="button" onClick={openForm}
                  disabled={isCompanyScope && !selectedStoreUuid}
                  className={`${btnPrimary} ${isCompanyScope && !selectedStoreUuid ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <SlidersHorizontal size={24} />
                  Nouvel ajustement
                </button>
              )}
            </div>
          )}
          {!showForm && (
            <StockMovementList
              movements={displayMovements}
              loading={loading} search={search} page={page}
              count={count} next={hasNext} prev={hasPrev}
              onSearchChange={setSearch} onPageChange={setPage}
              onDelete={canAdjust ? handleDeleteMovement : undefined}
              canEdit={canAdjust}
            />
          )}
        </div>
      )}

      {tab === 'stock-transfer' && (
        <div>
          {showForm ? (
            <StockTransferForm
              form={transferForm} products={products} stores={stores}
              fromStoreUuid={isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '')}
              error={error} submitting={submitting}
              onChange={(e) => setTransferForm({ ...transferForm, [e.target.name]: e.target.value })}
              onSubmit={handleTransferSubmit} onClose={closeForm}
            />
          ) : (
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted text-lg">Transferts de stock</p>
              {canTransfer && (
                <button type="button" onClick={openForm}
                  disabled={isCompanyScope && !selectedStoreUuid}
                  className={`${btnPrimary} ${isCompanyScope && !selectedStoreUuid ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <ArrowLeftRight size={24} />
                  Nouveau transfert
                </button>
              )}
            </div>
          )}
          {!showForm && (
            <StockMovementList
              movements={displayMovements}
              loading={loading} search={search} page={page}
              count={count} next={hasNext} prev={hasPrev}
              onSearchChange={setSearch} onPageChange={setPage}
              onDelete={canAdjust ? handleDeleteMovement : undefined}
              canEdit={canAdjust}
            />
          )}
        </div>
      )}

      {tab === 'stock-history' && (
        <StockMovementList
          movements={displayMovements} loading={loading} search={search}
          page={page} count={count} next={hasNext} prev={hasPrev}
          onSearchChange={setSearch} onPageChange={setPage}
        />
      )}

      <ConfirmDialog
        isOpen={confirm.open} title={confirm.title} message={confirm.message}
        onConfirm={confirm.onConfirm} onCancel={closeConfirm}
      />
    </div>
  );
};

export default InventoryModule;
