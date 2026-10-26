import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Plus, X, CheckCircle2, Ban, ScanBarcode } from 'lucide-react';
import { inventorySessionsAPI } from '../../../lib/api';
import { inputClass, labelClass, btnPrimary } from './constants';

const STATUS_LABELS = {
  open: 'Ouverte', counting: 'Comptage en cours',
  validated: 'Validée', cancelled: 'Annulée',
};
const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700',
  counting: 'bg-amber-100 text-amber-700',
  validated: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
const SCOPE_LABELS = {
  store: 'Magasin', warehouse: 'Entrepôt', location: 'Emplacement',
  product: 'Produit', lot: 'Lot',
};

const lineLabel = (l) => {
  const parts = [l.product?.name || '—'];
  if (l.variant?.attributes) {
    parts.push(Object.values(l.variant.attributes).join(' / '));
  }
  if (l.lot?.number) parts.push(`Lot ${l.lot.number}`);
  if (l.warehouse?.name) parts.push(`(${l.warehouse.name})`);
  return parts.join(' — ');
};

const diffClass = (d) =>
  d === 0 ? 'text-green-600' : d > 0 ? 'text-blue-600' : 'text-red-600';

// --- Écran de comptage mobile-first (étape 6.5) -------------------
const CountingScreen = ({ session, canValidate, online, onBack, onRefresh }) => {
  const [counts, setCounts] = useState({});
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');

  const lines = (session.lines || []).filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.product?.name?.toLowerCase().includes(q) ||
      l.product?.barcode?.toLowerCase().includes(q) ||
      l.variant?.sku?.toLowerCase().includes(q)
    );
  });

  const submitCount = async (line) => {
    const val = counts[line.id];
    if (val === undefined || val === '') return;
    setSaving(line.id);
    setError('');
    try {
      await inventorySessionsAPI.count(session.uuid, line.id, parseInt(val, 10));
      onRefresh();
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.counted_quantity
        || "Erreur lors de l'enregistrement du comptage.");
    } finally {
      setSaving(null);
    }
  };

  const counted = (session.lines || []).filter((l) => l.counted_quantity !== null).length;
  const total = (session.lines || []).length;
  const editable = session.status === 'open' || session.status === 'counting';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button type="button" onClick={onBack}
          className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-gray-100">
          ← Retour
        </button>
        <div className="text-base text-muted">{counted}/{total} lignes comptées</div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base">{error}</div>
      )}

      <div className="relative">
        <ScanBarcode size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Scanner ou rechercher un produit…"
          className={`${inputClass} pl-12`} />
      </div>

      <div className="space-y-3">
        {lines.map((l) => {
          const diff = l.counted_quantity !== null ? l.difference : null;
          return (
            <div key={l.id}
              className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-foreground text-lg leading-tight">
                  {lineLabel(l)}
                </div>
                <div className="text-sm text-muted whitespace-nowrap">
                  Attendu : <strong>{l.expected_quantity}</strong>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="number" min="0" inputMode="numeric" disabled={!editable}
                  value={counts[l.id] ?? (l.counted_quantity ?? '')}
                  onChange={(e) => setCounts({ ...counts, [l.id]: e.target.value })}
                  placeholder="Compté"
                  className="flex-1 px-4 py-4 text-2xl text-center border border-border rounded-2xl bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60" />
                {editable && (
                  <button type="button"
                    disabled={saving === l.id || counts[l.id] === undefined || counts[l.id] === ''}
                    onClick={() => submitCount(l)}
                    className="px-5 py-4 rounded-2xl bg-primary-600 text-white font-semibold disabled:opacity-50">
                    {saving === l.id ? '…' : 'OK'}
                  </button>
                )}
              </div>
              {diff !== null && (
                <div className={`text-base font-semibold ${diffClass(diff)}`}>
                  Écart : {diff > 0 ? `+${diff}` : diff}
                </div>
              )}
            </div>
          );
        })}
        {lines.length === 0 && (
          <p className="text-muted text-center py-6">Aucune ligne dans cette session.</p>
        )}
      </div>

      {editable && canValidate && (
        <button type="button" disabled={!online}
          onClick={async () => {
            setError('');
            try {
              await inventorySessionsAPI.validate(session.uuid);
              onBack();
            } catch (e) {
              setError(e.response?.data?.detail || 'Erreur lors de la validation.');
            }
          }}
          className={`${btnPrimary} w-full flex items-center justify-center gap-2`}
          title={!online ? 'La validation exige une connexion' : ''}>
          <CheckCircle2 size={20} /> Valider l'inventaire
        </button>
      )}
      {!online && editable && (
        <p className="text-sm text-amber-600 text-center">
          Hors ligne : la validation sera faite une fois reconnecté.
        </p>
      )}
    </div>
  );
};

// --- Liste + création de sessions ---------------------------------
const InventorySessionsView = ({ storeUuid, warehouses, canAdjust, canValidate, online }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [active, setActive] = useState(null);
  const [form, setForm] = useState({ scope: 'store', warehouse: '', note: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventorySessionsAPI.list(1, storeUuid ? { store: storeUuid } : {});
      setSessions(res.data.results || res.data || []);
    } catch {
      setError('Impossible de charger les sessions.');
    } finally {
      setLoading(false);
    }
  }, [storeUuid]);

  useEffect(() => { load(); }, [load]);

  const refreshActive = useCallback(async () => {
    if (!active) return;
    try {
      const res = await inventorySessionsAPI.get(active.uuid);
      setActive(res.data);
    } catch { /* silencieux */ }
  }, [active]);

  const createSession = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await inventorySessionsAPI.create({
        store: storeUuid, scope: form.scope,
        warehouse: form.warehouse || undefined, note: form.note,
      });
      setShowForm(false);
      setForm({ scope: 'store', warehouse: '', note: '' });
      setActive(res.data);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la création.');
    }
  };

  const cancelSession = async (s) => {
    try {
      await inventorySessionsAPI.cancel(s.uuid);
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur lors de l'annulation.");
    }
  };

  if (active) {
    return (
      <CountingScreen session={active} canValidate={canValidate} online={online}
        onBack={() => { setActive(null); load(); }} onRefresh={refreshActive} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList size={22} /> Sessions d'inventaire
        </h2>
        {canAdjust && (
          <button type="button" onClick={() => setShowForm(!showForm)} className={btnPrimary}>
            <Plus size={18} className="inline mr-1" /> Nouvelle session
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-base">{error}</div>
      )}

      {showForm && (
        <form onSubmit={createSession}
          className="bg-surface rounded-2xl border border-border p-6 space-y-4 relative">
          <button type="button" onClick={() => setShowForm(false)}
            className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
            <X size={22} />
          </button>
          <h3 className="text-lg font-bold text-foreground">Ouvrir une session</h3>
          <div>
            <label className={labelClass}>Périmètre</label>
            <select value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value, warehouse: '' })}
              className={inputClass}>
              <option value="store">Magasin entier</option>
              <option value="warehouse">Entrepôt</option>
            </select>
          </div>
          {form.scope === 'warehouse' && (
            <div>
              <label className={labelClass}>Entrepôt</label>
              <select value={form.warehouse} required
                onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
                className={inputClass}>
                <option value=""> Sélectionner </option>
                {(warehouses || []).map((w) => (
                  <option key={w.uuid} value={w.uuid}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelClass}>Note (optionnel)</label>
            <input value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className={inputClass} placeholder="Ex: inventaire mensuel" />
          </div>
          <button type="submit" className={btnPrimary}>Ouvrir la session</button>
        </form>
      )}

      {loading ? (
        <p className="text-muted">Chargement</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.uuid}
              className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <button type="button" onClick={() => setActive(s)} className="text-left flex-1 min-w-0">
                <div className="font-semibold text-foreground">
                  {SCOPE_LABELS[s.scope] || s.scope}{s.warehouse?.name ? `  ${s.warehouse.name}` : ''}
                </div>
                <div className="text-sm text-muted">
                  {(s.lines || []).length} lignes  {new Date(s.opened_at).toLocaleString('fr-FR')}
                </div>
              </button>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[s.status] || ''}`}>
                  {STATUS_LABELS[s.status] || s.status}
                </span>
                {canAdjust && (s.status === 'open' || s.status === 'counting') && (
                  <button type="button" onClick={() => cancelSession(s)}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-50" title="Annuler">
                    <Ban size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-muted text-center py-6">Aucune session d'inventaire.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default InventorySessionsView;
