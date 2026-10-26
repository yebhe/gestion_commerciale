import { useCallback, useEffect, useState } from 'react';
import { Warehouse, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { warehousesAPI, settingsAPI } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import Loader from '../../../contexts/Loader';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import AlertDialog from '../../../components/ui/AlertDialog';
import { inputClass, labelClass, btnPrimary, btnSecondary, btnIcon, btnDanger } from '../inventory/constants';

const TYPE_OPTIONS = [
  { value: 'main', label: 'Principal' },
  { value: 'secondary', label: 'Secondaire' },
  { value: 'regional', label: 'Régional' },
  { value: 'reserve', label: 'Réserve' },
  { value: 'zone', label: 'Zone' },
  { value: 'logistics', label: 'Logistique' },
];

const EMPTY = { name: '', code: '', type: 'secondary', address: '', is_default: false };

/**
 * Onglet Entrepôts d'un magasin (_docs/15, étape 1.8).
 * CRUD /api/inventory/warehouses/?store=<uuid>.
 */
const WarehouseSection = ({ store }) => {
  const { hasPermission } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });

  const canCreate = hasPermission('warehouses.create');
  const canUpdate = hasPermission('warehouses.update');
  const canDelete = hasPermission('warehouses.delete');
  const [mode, setMode] = useState('simple');

  useEffect(() => {
    settingsAPI.getSettings(store.uuid)
      .then((res) => setMode(res.data?.mode || 'simple'))
      .catch(() => setMode('simple'));
  }, [store.uuid]);

  // Mode simple : un seul entrepôt par magasin (_docs/15, étape 16.1).
  const canAddWarehouse = canCreate && (mode === 'advanced' || warehouses.length === 0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await warehousesAPI.list(1, '', store.uuid);
      setWarehouses(res.data.results || res.data || []);
    } catch {
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  }, [store.uuid]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setError(''); setShowForm(true); };
  const openEdit = (w) => {
    setEditing(w);
    setForm({ name: w.name, code: w.code, type: w.type, address: w.address || '', is_default: w.is_default });
    setError(''); setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      setError('Le nom et le code sont obligatoires.'); return;
    }
    setSubmitting(true); setError('');
    try {
      const payload = { ...form, store: store.uuid };
      if (editing) await warehousesAPI.update(editing.uuid, payload);
      else await warehousesAPI.create(payload);
      setShowForm(false);
      await load();
    } catch (err) {
      const msg = err.response?.data ? Object.values(err.response.data).flat().join(' ') : "Impossible d'enregistrer cet entrepôt.";
      setError(msg);
    } finally { setSubmitting(false); }
  };

  const handleDelete = (w) => {
    setConfirm({
      open: true, title: "Supprimer l'entrepôt",
      message: `Voulez-vous vraiment supprimer "${w.name}" ?`,
      onConfirm: async () => {
        try {
          await warehousesAPI.remove(w.uuid);
          setConfirm({ ...confirm, open: false });
          await load();
        } catch (err) {
          setConfirm({ ...confirm, open: false });
          const msg = err.response?.data?.detail || "Impossible de supprimer cet entrepôt.";
          setAlert({ type: 'error', title: 'Erreur', message: msg });
        }
      },
    });
  };

  if (loading) return <Loader fullscreen={false} />;

  return (
    <div>
      <AlertDialog alert={alert} onClose={() => setAlert(null)} />

      <div className="flex items-center justify-between mb-4">
        <p className="text-muted text-base">{warehouses.length} entrepôt(s)</p>
        {canAddWarehouse && (
          <button type="button" onClick={openCreate} className={btnPrimary}>
            <Plus size={20} /> Ajouter un entrepôt
          </button>
        )}
        {canCreate && mode === 'simple' && warehouses.length > 0 && (
          <p className="text-xs text-muted">Mode simple : un seul entrepôt par magasin.</p>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-5 mb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nom *</label>
              <input name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Code *</label>
              <input name="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select name="type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputClass}>
                {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Adresse</label>
              <input name="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-base text-foreground">
            <input type="checkbox" checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
            Entrepôt par défaut du magasin
          </label>
          {error && <p className="text-red-600 text-base">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? 'Enregistrement…' : editing ? 'Modifier' : 'Créer'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className={btnSecondary}>Annuler</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {warehouses.map((w) => (
          <div key={w.uuid} className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Warehouse size={22} className="text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground flex items-center gap-2">
                {w.name}
                {w.is_default && <Star size={16} className="text-amber-500 fill-amber-500" />}
                <span className="text-xs text-muted font-normal">({w.code})</span>
              </p>
              <p className="text-sm text-muted">
                {TYPE_OPTIONS.find((t) => t.value === w.type)?.label || w.type}
                {w.address ? ` · ${w.address}` : ''}
                {w.is_active === false ? ' · Inactif' : ''}
              </p>
            </div>
            {canUpdate && <button onClick={() => openEdit(w)} className={btnIcon}><Pencil size={20} /></button>}
            {canDelete && !w.is_default && (
              <button onClick={() => handleDelete(w)} className={btnDanger}><Trash2 size={20} /></button>
            )}
          </div>
        ))}
        {!warehouses.length && (
          <p className="text-muted text-center py-6">Aucun entrepôt pour ce magasin.</p>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirm.open} title={confirm.title} message={confirm.message}
        onConfirm={confirm.onConfirm} onCancel={() => setConfirm({ ...confirm, open: false })}
      />
    </div>
  );
};

export default WarehouseSection;
