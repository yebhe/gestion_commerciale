import { useEffect, useState, useCallback } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { storesAPI } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import AlertDialog from '../../../components/ui/AlertDialog';
import { EMPTY_FORM, btnPrimary } from './constants';
import StoreForm from './StoreForm';
import StoreList from './StoreList';
import WarehouseSection from './WarehouseSection';

const StoresModule = () => {
  const { hasPermission, scope, assignedStore } = useAuth();
  const isCompanyScope = scope === 'COMPANY';

  const [stores, setStores] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [storePage, setStorePage] = useState(1);
  const [storeCount, setStoreCount] = useState(0);
  const [storeNext, setStoreNext] = useState(null);
  const [storePrev, setStorePrev] = useState(null);
  const [storeSearch, setStoreSearch] = useState('');
  const [storeSearchDebounced, setStoreSearchDebounced] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [alert, setAlert] = useState(null);

  const showAlert = useCallback((type, title, message = '') => setAlert({ type, title, message }), []);
  const closeAlert = useCallback(() => setAlert(null), []);
  const closeConfirm = () => setConfirm({ ...confirm, open: false });

  const canCreate = hasPermission('stores.create');
  const canUpdate = hasPermission('stores.update');
  const canDelete = hasPermission('stores.delete');
  const canViewWarehouses = hasPermission('warehouses.view');
  const [warehouseStore, setWarehouseStore] = useState(null);

  const loadStores = async () => {
    setLoadingList(true);
    try {
      const res = await storesAPI.list(storePage, storeSearchDebounced);
      setStores(res.data.results || res.data || []);
      setStoreCount(res.data.count || (res.data.results || res.data || []).length);
      setStoreNext(res.data.next || null);
      setStorePrev(res.data.previous || null);
    } catch {
      setError('Impossible de charger la liste des magasins.');
      showAlert('error', 'Erreur', 'Impossible de charger la liste des magasins.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { setStoreSearchDebounced(storeSearch); setStorePage(1); }, 400);
    return () => clearTimeout(t);
  }, [storeSearch]);

  useEffect(() => { loadStores(); }, [storePage, storeSearchDebounced]);

  const openCreateForm = () => {
    if (!isCompanyScope) {
      showAlert('warning', 'Action non autorisée', 'Seuls les utilisateurs au niveau entreprise peuvent créer des magasins.');
      return;
    }
    setEditingStore(null); setForm(EMPTY_FORM); setLogoFile(null); setError(''); setShowForm(true);
  };

  const openEditForm = (store) => {
    setEditingStore(store);
    setForm({ name: store.name || '', address: store.address || '', phone: store.phone || '' });
    setLogoFile(null); setError(''); setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false); setEditingStore(null); setForm(EMPTY_FORM); setLogoFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = [];
    if (!form.name.trim()) errs.push('Le nom du magasin est obligatoire.');
    if (form.phone && !/^[\d\s+\-()]{6,}$/.test(form.phone.trim())) errs.push('Le numéro de téléphone n\'est pas valide.');
    if (errs.length) { setError(errs.join(' ')); return; }
    setError(''); setSubmitting(true);

    const data = new FormData();
    data.append('name', form.name.trim());
    data.append('address', form.address || '');
    data.append('phone', form.phone || '');
    if (logoFile) data.append('logo', logoFile);

    try {
      if (editingStore) {
        await storesAPI.update(editingStore.uuid, data);
        showAlert('success', 'Magasin modifié', `"${form.name}" a été mis à jour avec succès.`);
      } else {
        await storesAPI.create(data);
        showAlert('success', 'Magasin créé', `"${form.name}" a été ajouté avec succès.`);
      }
      closeForm(); await loadStores();
    } catch (err) {
      const msg = err.response?.data ? Object.values(err.response.data).flat().join(' ') : "Impossible d'enregistrer ce magasin.";
      setError(msg); showAlert('error', 'Erreur', msg);
    } finally { setSubmitting(false); }
  };

  const handleDelete = (store) => {
    if (!isCompanyScope) {
      showAlert('warning', 'Action non autorisée', 'Seuls les utilisateurs au niveau entreprise peuvent supprimer des magasins.');
      return;
    }
    setConfirm({
      open: true, title: 'Supprimer le magasin', message: `Voulez-vous vraiment supprimer "${store.name}" ?`,
      onConfirm: async () => {
        try {
          await storesAPI.remove(store.uuid);
          setConfirm({ ...confirm, open: false });
          showAlert('success', 'Magasin supprimé', `"${store.name}" a été supprimé avec succès.`);
          await loadStores();
        } catch {
          setConfirm({ ...confirm, open: false });
          showAlert('error', 'Erreur', 'Impossible de supprimer ce magasin.');
        }
      },
    });
  };

  return (
    <div>
      <AlertDialog alert={alert} onClose={closeAlert} />

      <div className="flex items-center justify-between mb-6">
        <p className="text-muted text-lg">{stores.length} magasin(s)</p>
        {canCreate && isCompanyScope && (
          <button type="button" onClick={openCreateForm} className={btnPrimary}>
            <Plus size={24} />
            Ajouter un magasin
          </button>
        )}
      </div>

      {warehouseStore ? (
        <div>
          <button type="button" onClick={() => setWarehouseStore(null)}
            className="flex items-center gap-2 mb-5 text-muted hover:text-foreground text-base font-medium">
            <ArrowLeft size={20} /> Retour aux magasins
          </button>
          <h2 className="text-xl font-bold text-foreground mb-4">
            Entrepôts — {warehouseStore.name}
          </h2>
          <WarehouseSection store={warehouseStore} />
        </div>
      ) : showForm ? (
        <StoreForm
          editingStore={editingStore} form={form} logoFile={logoFile}
          error={error} submitting={submitting}
          onChange={(e) => setForm({ ...form, [e.target.name]: e.target.value })}
          onLogoChange={(e) => setLogoFile(e.target.files?.[0] || null)}
          onSubmit={handleSubmit} onClose={closeForm}
        />
      ) : (
        <StoreList
          stores={stores} loading={loadingList} search={storeSearch}
          page={storePage} count={storeCount} next={storeNext} prev={storePrev}
          canUpdate={canUpdate} canDelete={canDelete}
          isCompanyScope={isCompanyScope} assignedStore={assignedStore}
          canViewWarehouses={canViewWarehouses}
          onSearchChange={setStoreSearch} onPageChange={setStorePage}
          onEdit={openEditForm} onDelete={handleDelete}
          onWarehouses={setWarehouseStore}
        />
      )}

      <ConfirmDialog
        isOpen={confirm.open} title={confirm.title} message={confirm.message}
        onConfirm={confirm.onConfirm} onCancel={closeConfirm}
      />
    </div>
  );
};

export default StoresModule;
