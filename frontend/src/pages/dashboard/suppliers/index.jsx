import { useEffect, useState, useCallback, useMemo } from 'react';
import api, { suppliersAPI, storesAPI } from '../../../lib/api';
import db from '../../../pwa/db';
import networkManager from '../../../pwa/networkManager';
import { loadStoresWithCache } from '../../../pwa/preloadCache';
import { usePWA } from '../../../pwa/PWAContext';
import { useOfflineMutation } from '../../../pwa/useOfflineMutation';
import { useSyncRefresh } from '../../../pwa';
import { useAuth } from '../../../contexts/AuthContext';
import { consumePendingSearch } from '../../../lib/pendingSearch';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import AlertDialog from '../../../components/ui/AlertDialog';
import { EMPTY_FORM } from './constants';
import SupplierForm from './SupplierForm';
import SupplierList from './SupplierList';

const PAGE_SIZE = 10;

const SuppliersModule = () => {
  const { user, hasPermission, scope, assignedStore } = useAuth();
  const { online } = usePWA();
  const isCompanyScope = scope === 'COMPANY';

  const [stores, setStores] = useState([]);
  const [selectedStoreUuid, setSelectedStoreUuid] = useState(
    !isCompanyScope && assignedStore ? assignedStore.uuid : ''
  );
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [prev, setPrev] = useState(null);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [alert, setAlert] = useState(null);
  const { mutate: createSupplier } = useOfflineMutation('suppliers', 'CREATE');
  const { mutate: updateSupplier } = useOfflineMutation('suppliers', 'UPDATE');
  const { mutate: deleteSupplier } = useOfflineMutation('suppliers', 'DELETE');

  useEffect(() => {
    const pending = consumePendingSearch('suppliers');
    if (pending) setSearch(pending);
  }, []);

  const showAlert = useCallback((type, title, message = '') => setAlert({ type, title, message }), []);
  const closeAlert = useCallback(() => setAlert(null), []);
  const closeConfirm = () => setConfirm({ ...confirm, open: false });

  const canCreate = hasPermission('suppliers.create');
  const canUpdate = hasPermission('suppliers.update');
  const canDelete = hasPermission('suppliers.delete');

  const loadStores = async () => {
    try {
      const all = await loadStoresWithCache();
      setStores(all);
    } catch { /* ignore */ }
  };

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const storeParam = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
      const companyUuid = localStorage.getItem('current_company_uuid') || '';
      const searchLower = searchDebounced.toLowerCase();

      if (!networkManager.getState().online) {
        const cached = await db.suppliers.where('company_uuid').equals(companyUuid).toArray();
        let all = cached.filter((s) => !s.is_deleted);
        if (storeParam) {
          all = all.filter((s) =>
            (!s.store_uuid && !s.store) || s.store_uuid === storeParam || s.store === storeParam
          );
        }
        if (searchDebounced) {
          all = all.filter((s) =>
            (s.name || '').toLowerCase().includes(searchLower) ||
            (s.phone || '').toLowerCase().includes(searchLower) ||
            (s.email || '').toLowerCase().includes(searchLower)
          );
        }
        setSuppliers(all);
        setCount(all.length);
        setNext(null);
        setPrev(null);
        setLoading(false);
        return;
      }

      const all = [];
      let p = 1;
      while (true) {
        const res = await api.get('/suppliers/', { params: { page: p, ...(searchDebounced && { search: searchDebounced }), ...(storeParam && { store: storeParam }) } });
        const results = res.data.results || res.data || [];
        all.push(...results);
        if (!res.data.next) break;
        p++;
        if (p > 50) break;
      }

      setSuppliers(all);
      setCount(all.length);

      if (companyUuid) {
        const tag = (items) => items.map((item) => ({
          ...item,
          company_uuid: companyUuid,
          store_uuid: storeParam || item.store || '',
          user_uuid: user?.uuid,
          updated_at: new Date().toISOString(),
        }));
        await db.suppliers.bulkPut(tag(all));
      }
    } catch {
      try {
        const companyUuid = localStorage.getItem('current_company_uuid') || '';
        const storeParam = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
        let all = (await db.suppliers.where('company_uuid').equals(companyUuid).toArray()).filter((s) => !s.is_deleted);
        if (storeParam) {
          all = all.filter((s) =>
            (!s.store_uuid && !s.store) || s.store_uuid === storeParam || s.store === storeParam
          );
        }
        if (searchDebounced) {
          const searchLower = searchDebounced.toLowerCase();
          all = all.filter((s) =>
            (s.name || '').toLowerCase().includes(searchLower) ||
            (s.phone || '').toLowerCase().includes(searchLower) ||
            (s.email || '').toLowerCase().includes(searchLower)
          );
        }
        setSuppliers(all);
        setCount(all.length);
        setNext(null);
        setPrev(null);
      } catch (cacheErr) {
        setError('Impossible de charger la liste des fournisseurs.');
        showAlert('error', 'Erreur', 'Impossible de charger la liste des fournisseurs.');
      }
    } finally {
      setLoading(false);
    }
  }, [isCompanyScope, selectedStoreUuid, assignedStore, searchDebounced, online, user]);

  useSyncRefresh(loadSuppliers);

  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { if (isCompanyScope) loadStores(); }, []);
  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const openCreateForm = () => {
    setEditingSupplier(null); setForm(EMPTY_FORM); setError(''); setShowForm(true);
  };

  const openEditForm = (supplier) => {
    setEditingSupplier(supplier);
    setForm({ name: supplier.name || '', phone: supplier.phone || '', email: supplier.email || '', store: supplier.store?.uuid || '' });
    setError(''); setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false); setEditingSupplier(null); setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Veuillez saisir le nom du fournisseur.'); return; }
    setError(''); setSubmitting(true);
    try {
      const payload = { ...form };
      if (!isCompanyScope && assignedStore && !payload.store) {
        payload.store = assignedStore.uuid;
      }
      const context = {
        company_uuid: localStorage.getItem('current_company_uuid'),
        store_uuid: selectedStoreUuid || assignedStore?.uuid || null,
        user_uuid: user?.uuid,
      };
      if (editingSupplier) {
        await updateSupplier(payload, { ...context, entity_uuid: editingSupplier.uuid });
        showAlert('success', 'Fournisseur modifié', `"${form.name}" a été mis à jour avec succès.`);
      } else {
        await createSupplier(payload, context);
        showAlert('success', 'Fournisseur créé', `"${form.name}" a été ajouté avec succès.`);
      }
      closeForm(); await loadSuppliers();
    } catch (err) {
      const msg = err.response?.data ? Object.values(err.response.data).flat().join(' ') : "Impossible d'enregistrer ce fournisseur.";
      setError(msg); showAlert('error', 'Erreur', msg);
    } finally { setSubmitting(false); }
  };

  const handleDelete = (supplier) => {
    setConfirm({
      open: true, title: 'Supprimer le fournisseur',
      message: `Voulez-vous vraiment supprimer "${supplier.name}" ?`,
      onConfirm: async () => {
        try {
          await deleteSupplier(null, {
            company_uuid: localStorage.getItem('current_company_uuid'),
            store_uuid: selectedStoreUuid || assignedStore?.uuid || null,
            user_uuid: user?.uuid,
            entity_uuid: supplier.uuid,
          });
          setConfirm({ ...confirm, open: false });
          showAlert('success', 'Fournisseur supprimé', `"${supplier.name}" a été supprimé avec succès.`);
          await loadSuppliers();
        } catch {
          setConfirm({ ...confirm, open: false });
          showAlert('error', 'Erreur', 'Impossible de supprimer ce fournisseur.');
        }
      },
    });
  };

  const displaySuppliers = useMemo(() => suppliers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [suppliers, page]);
  const hasNext = page * PAGE_SIZE < count;
  const hasPrev = page > 1;

  return (
    <div>
      <AlertDialog alert={alert} onClose={closeAlert} />

      {isCompanyScope && (
        <div className="bg-primary-50 border border-primary-200 rounded-2xl p-5 mb-6">
          <label className="text-base font-semibold text-foreground mb-2 block">Magasin</label>
          <select value={selectedStoreUuid} onChange={(e) => setSelectedStoreUuid(e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl text-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">— Tous les magasins —</option>
            {stores.map((s) => (
              <option key={s.uuid} value={s.uuid}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {showForm ? (
        <SupplierForm
          editingSupplier={editingSupplier} form={form}
          error={error} submitting={submitting}
          stores={stores} isCompanyScope={isCompanyScope}
          onChange={(e) => setForm({ ...form, [e.target.name]: e.target.value })}
          onSubmit={handleSubmit} onClose={closeForm}
        />
      ) : (
        <SupplierList
          suppliers={displaySuppliers} loading={loading} search={search}
          page={page} count={count} next={hasNext} prev={hasPrev}
          canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete}
          onSearchChange={setSearch} onPageChange={setPage}
          onEdit={openEditForm} onDelete={handleDelete} onCreate={openCreateForm}
        />
      )}

      <ConfirmDialog
        isOpen={confirm.open} title={confirm.title} message={confirm.message}
        onConfirm={confirm.onConfirm} onCancel={closeConfirm}
      />
    </div>
  );
};

export default SuppliersModule;
