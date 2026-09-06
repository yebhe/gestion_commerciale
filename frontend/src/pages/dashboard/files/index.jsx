import { useEffect, useState, useCallback } from 'react';
import { filesAPI, storesAPI } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import AlertDialog from '../../../components/ui/AlertDialog';
import FileUploadForm from './FileUploadForm';
import FileList from './FileList';
import StoreSelector from '../products/StoreSelector';

const FilesModule = () => {
  const { hasPermission, scope, assignedStore } = useAuth();

  const isCompanyScope = scope === 'COMPANY';
  const [stores, setStores] = useState([]);
  const [selectedStoreUuid, setSelectedStoreUuid] = useState(
    !isCompanyScope && assignedStore ? assignedStore.uuid : ''
  );

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [prev, setPrev] = useState(null);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStore, setUploadStore] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [alert, setAlert] = useState(null);

  const showAlert = useCallback((type, title, message = '') => setAlert({ type, title, message }), []);
  const closeAlert = useCallback(() => setAlert(null), []);
  const closeConfirm = () => setConfirm({ ...confirm, open: false });

  const canUpload = hasPermission('files.upload');
  const canDelete = hasPermission('files.delete');

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

  const loadFiles = async () => {
    setLoading(true);
    try {
      const storeParam = isCompanyScope && selectedStoreUuid ? selectedStoreUuid : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
      const res = await filesAPI.list(page, searchDebounced, storeParam);
      setFiles(res.data.results || res.data || []);
      setCount(res.data.count || (res.data.results || res.data || []).length);
      setNext(res.data.next || null);
      setPrev(res.data.previous || null);
    } catch {
      setError('Impossible de charger la liste des fichiers.');
      showAlert('error', 'Erreur', 'Impossible de charger la liste des fichiers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { if (isCompanyScope) loadStores(); }, []);
  useEffect(() => { loadFiles(); }, [page, searchDebounced, selectedStoreUuid]);

  const openForm = () => {
    setSelectedFile(null);
    setUploadStore(selectedStoreUuid || '');
    setError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false); setSelectedFile(null); setUploadStore('');
  };

  const handleSubmit = async () => {
    if (!selectedFile) { setError('Veuillez sélectionner un fichier.'); return; }
    setError(''); setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('path', selectedFile);
      const storeParam = isCompanyScope ? uploadStore : (!isCompanyScope && assignedStore ? assignedStore.uuid : '');
      if (storeParam) formData.append('store', storeParam);
      await filesAPI.create(formData);
      showAlert('success', 'Fichier téléversé', `"${selectedFile.name}" a été ajouté avec succès.`);
      closeForm(); await loadFiles();
    } catch (err) {
      const msg = err.response?.data ? Object.values(err.response.data).flat().join(' ') : 'Erreur lors du téléversement.';
      setError(msg); showAlert('error', 'Erreur', msg);
    } finally { setSubmitting(false); }
  };

  const handleDelete = (file) => {
    setConfirm({
      open: true, title: 'Supprimer le fichier',
      message: `Voulez-vous vraiment supprimer "${file.path?.split('/').pop() || 'ce fichier'}" ?`,
      onConfirm: async () => {
        try {
          await filesAPI.remove(file.uuid);
          setConfirm({ ...confirm, open: false });
          showAlert('success', 'Fichier supprimé', 'Le fichier a été supprimé avec succès.');
          await loadFiles();
        } catch {
          setConfirm({ ...confirm, open: false });
          showAlert('error', 'Erreur', 'Impossible de supprimer ce fichier.');
        }
      },
    });
  };

  return (
    <div>
      <AlertDialog alert={alert} onClose={closeAlert} />

      {isCompanyScope && (
        <StoreSelector
          stores={stores}
          selectedStoreUuid={selectedStoreUuid}
          onChange={setSelectedStoreUuid}
        />
      )}

      {showForm ? (
        <FileUploadForm
          error={error} submitting={submitting}
          stores={stores} isCompanyScope={isCompanyScope}
          uploadStore={uploadStore} onStoreChange={setUploadStore}
          onFileChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          onSubmit={handleSubmit} onClose={closeForm}
        />
      ) : (
        <FileList
          files={files} loading={loading} search={search}
          page={page} count={count} next={next} prev={prev}
          canUpload={canUpload} canDelete={canDelete}
          onSearchChange={setSearch} onPageChange={setPage}
          onDelete={handleDelete} onUpload={openForm}
          disabledUpload={isCompanyScope && !selectedStoreUuid}
        />
      )}

      <ConfirmDialog
        isOpen={confirm.open} title={confirm.title} message={confirm.message}
        onConfirm={confirm.onConfirm} onCancel={closeConfirm}
      />
    </div>
  );
};

export default FilesModule;
