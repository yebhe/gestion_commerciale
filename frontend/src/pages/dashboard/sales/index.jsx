import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Plus, Receipt, RotateCcw } from 'lucide-react';
import api, { salesAPI, productsAPI, customersAPI, storesAPI } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useSyncRefresh } from '../../../pwa';
import { applyPendingStock } from '../../../pwa/applyPendingStock';
import { consumePendingSearch } from '../../../lib/pendingSearch';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import AlertDialog from '../../../components/ui/AlertDialog';
import { EMPTY_FORM, btnPrimary } from './constants';
import SaleList from './SaleList';
import SaleDetail from './SaleDetail';
import SaleForm from './SaleForm';
import RefundsList from './RefundsList';

const TABS = [
  { key: 'new-sale', label: 'Nouvelle vente', icon: Plus },
  { key: 'sales-history', label: 'Historique', icon: Receipt },
  { key: 'refunds', label: 'Remboursements', icon: RotateCcw },
];

const SalesModule = ({ sub, onBack }) => {
  const { hasPermission, scope, assignedStore } = useAuth();
  const isCompanyScope = scope === 'COMPANY';
  const [tab, setTab] = useState(sub || 'sales-history');

  const [stores, setStores] = useState([]);
  const [selectedStoreUuid, setSelectedStoreUuid] = useState(
    !isCompanyScope && assignedStore ? assignedStore.uuid : ''
  );
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [prev, setPrev] = useState(null);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewingSale, setViewingSale] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const pending = consumePendingSearch('sales');
    if (pending) setSearch(pending);
  }, []);

  const showAlert = useCallback((type, title, message = '') => setAlert({ type, title, message }), []);
  const closeAlert = useCallback(() => setAlert(null), []);
  const closeConfirm = () => setConfirm({ ...confirm, open: false });

  const canCreate = hasPermission('sales.create');
  const canRefund = hasPermission('sales.refund');
  const canCancel = hasPermission('sales.cancel');

  const tabsFiltered = TABS.filter((t) => {
    if (t.key === 'new-sale') return canCreate;
    if (t.key === 'sales-history') return hasPermission('sales.view');
    if (t.key === 'refunds') return canRefund || canCancel;
    return true;
  });

  const loadStores = async () => {
    try {
      const all = [];
      let p = 1;
      while (true) {
        const res = await storesAPI.list(p);
        const results = res.data.results || res.data || [];
        all.push(...results);
        if (!res.data.next) break;
        p++;
        if (p > 50) break;
      }
      setStores(all);
    } catch { /* ignore */ }
  };

  const loadProducts = async () => {
    try {
      let all = [];
      let p = 1;
      let hasMore = true;
      const storeParam = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
      while (hasMore) {
        const res = await api.get('/products/', { params: { page: p, ...(storeParam && { store: storeParam }) } });
        const pageData = res.data.results || res.data || [];
        all = all.concat(pageData);
        hasMore = !!res.data.next;
        p++;
        if (p > 50) break;
      }
      setProducts(await applyPendingStock(all, storeParam));
    } catch { /* ignore */ }
  };

  const loadCustomers = async () => {
    try {
      let all = [];
      let p = 1;
      let hasMore = true;
      const storeParam = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
      while (hasMore) {
        const res = await api.get('/customers/', { params: { page: p, ...(storeParam && { store: storeParam }) } });
        const pageData = res.data.results || res.data || [];
        all = all.concat(pageData);
        hasMore = !!res.data.next;
        p++;
        if (p > 50) break;
      }
      setCustomers(all);
    } catch { /* ignore */ }
  };

  const loadSales = async () => {
    setLoading(true);
    try {
      const storeParam = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
      if (!storeParam) {
        setSales([]); setCount(0);
        setNext(null); setPrev(null);
        return;
      }
      const params = { page: page || 1, ...(searchDebounced && { search: searchDebounced }), ...(storeParam && { store: storeParam }) };
      const res = await api.get('/sales/', { params });
      const allSales = res.data.results || res.data || [];
      const filtered = tab === 'refunds' ? allSales.filter((s) => s.status === 'completed') : allSales;
      setSales(filtered);
      setCount(res.data.count || allSales.length);
      setNext(res.data.next || null);
      setPrev(res.data.previous || null);
    } catch { setError('Impossible de charger les ventes.'); }
    finally { setLoading(false); }
  };

  useSyncRefresh(() => { loadProducts(); loadCustomers(); loadSales(); });

  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { if (isCompanyScope) loadStores(); loadCustomers(); }, []);
  useEffect(() => { loadProducts(); }, [selectedStoreUuid]);
  useEffect(() => { loadSales(); }, [page, searchDebounced, selectedStoreUuid, tab]);
  useEffect(() => { setTab(sub || 'sales-history'); setShowForm(false); setViewingSale(null); }, [sub]);

  const computeTotal = () => {
    return form.items.reduce((sum, item) => {
      const product = products.find((p) => p.uuid === item.product);
      return sum + (product ? product.selling_price * parseInt(item.quantity || 0) : 0);
    }, 0);
  };

  const closeForm = () => {
    setShowForm(false); setForm(EMPTY_FORM); setError('');
  };

  const openForm = () => {
    if (isCompanyScope && !selectedStoreUuid) {
      showAlert('warning', 'Magasin requis', 'Veuillez sélectionner un magasin.');
      return;
    }
    setForm(EMPTY_FORM); setError(''); setShowForm(true);
  };

  const handleItemChange = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  };

  const handleAddItem = () => {
    setForm({ ...form, items: [...form.items, { product: '', quantity: 1 }] });
  };

  const handleRemoveItem = (idx) => {
    if (form.items.length > 1) {
      setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
    }
  };

  const handleSubmit = async () => {
    const validItems = form.items.filter((i) => i.product && i.quantity > 0);
    if (validItems.length === 0) { setError('Veuillez ajouter au moins un article.'); return; }
    setError(''); setSubmitting(true);
    try {
      const payload = {
        store: selectedStoreUuid || undefined,
        customer: form.customer || undefined,
        payment_method: form.payment_method,
        items: validItems.map((i) => {
          const product = products.find((p) => p.uuid === i.product);
          return {
            product: i.product,
            quantity: parseInt(i.quantity),
            unit_price: product?.selling_price || 0,
          };
        }),
      };
      await salesAPI.create(payload);
      showAlert('success', 'Vente enregistrée', 'La vente a été créée avec succès.');
      closeForm(); setTab('sales-history'); await loadSales();
    } catch (err) {
      const msg = err.response?.data ? Object.values(err.response.data).flat().join(' ') : 'Erreur lors de la création de la vente.';
      setError(msg); showAlert('error', 'Erreur', msg);
    } finally { setSubmitting(false); }
  };

  const handleRefund = (sale) => {
    setConfirm({
      open: true, title: 'Rembourser la vente',
      message: `Voulez-vous vraiment rembourser la vente ${sale.receipt?.receipt_number || sale.uuid.slice(0, 8)} d'un montant de ${sale.total_amount} FCFA ?`,
      onConfirm: async () => {
        try {
          await salesAPI.update(sale.uuid, { status: 'refunded' });
          setConfirm({ ...confirm, open: false });
          showAlert('success', 'Vente remboursée', 'Le remboursement a été effectué.');
          await loadSales();
        } catch {
          setConfirm({ ...confirm, open: false });
          showAlert('error', 'Erreur', 'Impossible de rembourser cette vente.');
        }
      },
    });
  };

  const handleCancel = (sale) => {
    setConfirm({
      open: true, title: 'Annuler la vente',
      message: `Voulez-vous vraiment annuler la vente ${sale.receipt?.receipt_number || sale.uuid.slice(0, 8)} ?`,
      onConfirm: async () => {
        try {
          await salesAPI.remove(sale.uuid);
          setConfirm({ ...confirm, open: false });
          showAlert('success', 'Vente annulée', 'La vente a été annulée.');
          await loadSales();
        } catch {
          setConfirm({ ...confirm, open: false });
          showAlert('error', 'Erreur', 'Impossible d\'annuler cette vente.');
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
        {tabsFiltered.map((t) => {
          const TabIcon = t.icon;
          return (
            <button key={t.key} type="button"
              onClick={() => { setTab(t.key); setShowForm(false); setViewingSale(null); }}
              className={`px-5 py-3 text-base font-semibold ${tab === t.key ? 'border-b-2 border-primary-600 text-primary-600' : 'text-muted'}`}>
              <TabIcon size={20} className="inline mr-1" />
              {t.label}
            </button>
          );
        })}
      </div>

      {isCompanyScope && (
        <div className="bg-primary-50 border border-primary-200 rounded-2xl p-5 mb-6">
          <label className="text-base font-semibold text-foreground mb-2 block">Magasin</label>
          <select value={selectedStoreUuid} onChange={(e) => setSelectedStoreUuid(e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl text-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">— Choisir un magasin —</option>
            {stores.map((s) => (
              <option key={s.uuid} value={s.uuid}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {tab === 'new-sale' && (
        <div>
          {showForm ? (
            <SaleForm
              form={form} products={products} customers={customers}
              error={error} submitting={submitting} total={computeTotal()}
              storeUuid={selectedStoreUuid || (!isCompanyScope && assignedStore ? assignedStore.uuid : '')}
              onChange={(e) => setForm({ ...form, [e.target.name]: e.target.value })}
              onItemChange={handleItemChange}
              onAddItem={handleAddItem} onRemoveItem={handleRemoveItem}
              onSubmit={handleSubmit} onClose={() => setTab('sales-history')}
            />
          ) : (
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted text-lg">Créer une nouvelle vente</p>
              <button type="button" onClick={openForm}
                disabled={isCompanyScope && !selectedStoreUuid}
                className={`${btnPrimary} ${isCompanyScope && !selectedStoreUuid ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <Plus size={24} />
                Nouvelle vente
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'sales-history' && (
        <div>
          {viewingSale ? (
            <SaleDetail sale={viewingSale} onClose={() => setViewingSale(null)} />
          ) : (
            <SaleList
              sales={sales} loading={loading} search={search}
              page={page} count={count} next={next} prev={prev}
              isCompanyScope={isCompanyScope} selectedStoreUuid={selectedStoreUuid}
              onSearchChange={setSearch} onPageChange={setPage}
              onView={setViewingSale}
            />
          )}
        </div>
      )}

      {tab === 'refunds' && (
        <RefundsList
          sales={sales} loading={loading} search={search}
          page={page} count={count} next={next} prev={prev}
          isCompanyScope={isCompanyScope} selectedStoreUuid={selectedStoreUuid}
          canRefund={canRefund} canCancel={canCancel}
          onSearchChange={setSearch} onPageChange={setPage}
          onRefund={handleRefund} onCancel={handleCancel}
        />
      )}

      <ConfirmDialog
        isOpen={confirm.open} title={confirm.title} message={confirm.message}
        onConfirm={confirm.onConfirm} onCancel={closeConfirm}
      />
    </div>
  );
};

export default SalesModule;
