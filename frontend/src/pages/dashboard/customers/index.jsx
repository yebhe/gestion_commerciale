import { useEffect, useState, useCallback, useMemo } from 'react';
import api, { customersAPI, storesAPI } from '../../../lib/api';
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
import CustomerForm from './CustomerForm';
import CustomerList from './CustomerList';

const PAGE_SIZE = 10;

const CustomersModule = () => {
  const { user, hasPermission, scope, assignedStore } = useAuth();
  const { online } = usePWA();
  const isCompanyScope = scope === 'COMPANY';

  const [stores, setStores] = useState([]);
  const [selectedStoreUuid, setSelectedStoreUuid] = useState(
    !isCompanyScope && assignedStore ? assignedStore.uuid : ''
  );
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [prev, setPrev] = useState(null);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [alert, setAlert] = useState(null);
  const { mutate: createCustomer } = useOfflineMutation('customers', 'CREATE');
  const { mutate: updateCustomer } = useOfflineMutation('customers', 'UPDATE');
  const { mutate: deleteCustomer } = useOfflineMutation('customers', 'DELETE');

  useEffect(() => {
    const pending = consumePendingSearch('customers');
    if (pending) setSearch(pending);
  }, []);

  const showAlert = useCallback((type, title, message = '') => setAlert({ type, title, message }), []);
  const closeAlert = useCallback(() => setAlert(null), []);
  const closeConfirm = () => setConfirm({ ...confirm, open: false });

  const canCreate = hasPermission('customers.create');
  const canUpdate = hasPermission('customers.update');
  const canDelete = hasPermission('customers.delete');

  const loadStores = async () => {
    try {
      const all = await loadStoresWithCache();
      setStores(all);
    } catch { /* ignore */ }
  };

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const storeParam = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
      const companyUuid = localStorage.getItem('current_company_uuid') || '';
      const searchLower = searchDebounced.toLowerCase();

      if (!networkManager.getState().online) {
        const cached = await db.customers.where('company_uuid').equals(companyUuid).toArray();
        let all = cached.filter((c) => !c.is_deleted);
        if (storeParam) {
          all = all.filter((c) =>
            (!c.store_uuid && !c.store) || c.store_uuid === storeParam || c.store === storeParam
          );
        }
        if (searchDebounced) {
          all = all.filter((c) =>
            (c.name || '').toLowerCase().includes(searchLower) ||
            (c.phone || '').toLowerCase().includes(searchLower) ||
            (c.email || '').toLowerCase().includes(searchLower)
          );
        }
        setCustomers(all);
        setCount(all.length);
        setNext(null);
        setPrev(null);
        setLoading(false);
        return;
      }

      const all = [];
      let p = 1;
      while (true) {
        const res = await api.get('/customers/', { params: { page: p, ...(searchDebounced && { search: searchDebounced }), ...(storeParam && { store: storeParam }) } });
        const results = res.data.results || res.data || [];
        all.push(...results);
        if (!res.data.next) break;
        p++;
        if (p > 50) break;
      }

      setCustomers(all);
      setCount(all.length);

      if (companyUuid) {
        const tag = (items) => items.map((item) => ({
          ...item,
          company_uuid: companyUuid,
          store_uuid: storeParam || item.store || '',
          user_uuid: user?.uuid,
          updated_at: new Date().toISOString(),
        }));
        await db.customers.bulkPut(tag(all));
      }
    } catch {
      try {
        const companyUuid = localStorage.getItem('current_company_uuid') || '';
        const storeParam = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
        let all = (await db.customers.where('company_uuid').equals(companyUuid).toArray()).filter((c) => !c.is_deleted);
        if (storeParam) {
          all = all.filter((c) =>
            (!c.store_uuid && !c.store) || c.store_uuid === storeParam || c.store === storeParam
          );
        }
        if (searchDebounced) {
          const searchLower = searchDebounced.toLowerCase();
          all = all.filter((c) =>
            (c.name || '').toLowerCase().includes(searchLower) ||
            (c.phone || '').toLowerCase().includes(searchLower) ||
            (c.email || '').toLowerCase().includes(searchLower)
          );
        }
        setCustomers(all);
        setCount(all.length);
        setNext(null);
        setPrev(null);
      } catch (cacheErr) {
        setError('Impossible de charger la liste des clients.');
        showAlert('error', 'Erreur', 'Impossible de charger la liste des clients.');
      }
    } finally {
      setLoading(false);
    }
  }, [isCompanyScope, selectedStoreUuid, assignedStore, searchDebounced, online, user]);

  useSyncRefresh(loadCustomers);

  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { if (isCompanyScope) loadStores(); }, []);
  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const openCreateForm = () => {
    setEditingCustomer(null); setForm(EMPTY_FORM); setError(''); setShowForm(true);
  };

  const openEditForm = (customer) => {
    setEditingCustomer(customer);
    setForm({ name: customer.name || '', phone: customer.phone || '', email: customer.email || '', store: customer.store?.uuid || '' });
    setError(''); setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false); setEditingCustomer(null); setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Veuillez saisir le nom du client.'); return; }
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
      if (editingCustomer) {
        await updateCustomer(payload, { ...context, entity_uuid: editingCustomer.uuid });
        showAlert('success', 'Client modifié', `"${form.name}" a été mis à jour avec succès.`);
      } else {
        await createCustomer(payload, context);
        showAlert('success', 'Client créé', `"${form.name}" a été ajouté avec succès.`);
      }
      closeForm(); await loadCustomers();
    } catch (err) {
      const msg = err.response?.data ? Object.values(err.response.data).flat().join(' ') : "Impossible d'enregistrer ce client.";
      setError(msg); showAlert('error', 'Erreur', msg);
    } finally { setSubmitting(false); }
  };

  const handleDelete = (customer) => {
    setConfirm({
      open: true, title: 'Supprimer le client',
      message: `Voulez-vous vraiment supprimer "${customer.name}" ?`,
      onConfirm: async () => {
        try {
          await deleteCustomer(null, {
            company_uuid: localStorage.getItem('current_company_uuid'),
            store_uuid: selectedStoreUuid || assignedStore?.uuid || null,
            user_uuid: user?.uuid,
            entity_uuid: customer.uuid,
          });
          setConfirm({ ...confirm, open: false });
          showAlert('success', 'Client supprimé', `"${customer.name}" a été supprimé avec succès.`);
          await loadCustomers();
        } catch {
          setConfirm({ ...confirm, open: false });
          showAlert('error', 'Erreur', 'Impossible de supprimer ce client.');
        }
      },
    });
  };

  const displayCustomers = useMemo(() => customers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [customers, page]);
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
        <CustomerForm
          editingCustomer={editingCustomer} form={form}
          error={error} submitting={submitting}
          stores={stores} isCompanyScope={isCompanyScope}
          onChange={(e) => setForm({ ...form, [e.target.name]: e.target.value })}
          onSubmit={handleSubmit} onClose={closeForm}
        />
      ) : (
        <CustomerList
          customers={displayCustomers} loading={loading} search={search}
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

export default CustomersModule;
