import { useEffect, useState, useCallback } from 'react';
import { X, UploadCloud, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { usePWA } from './PWAContext';
import { useAuth } from '../contexts/AuthContext';
import db, { ENTITY_TO_TABLE } from './db';
import syncManager from './syncManager';

const labels = {
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
};

const statusLabels = {
  PENDING_SYNC: 'En attente',
  FAILED: 'Échec',
  conflict: 'Conflit',
  SYNCING: 'En cours',
};

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('fr-FR');
  } catch {
    return iso;
  }
}

function opSummary(op) {
  const payload = op.payload || {};
  if (op.entity_type === 'sale' && payload.items) {
    const count = payload.items.reduce((s, i) => s + (i.quantity || 0), 0);
    return `Vente de ${count} article(s)`;
  }
  if (op.entity_type === 'stockMovement' && payload.quantity != null) {
    return `${payload.type || payload.movement_type || 'mvt'} de ${payload.quantity}`;
  }
  if (op.entity_type === 'product' && (payload.name || payload.get?.('name'))) {
    return payload.name || payload.get?.('name') || '';
  }
  return op.entity_uuid ? `UUID: ${op.entity_uuid}` : '';
}

export default function PendingOps({ open, onClose }) {
  const { syncNow, refreshPendingCount } = usePWA();
  const { user } = useAuth();
  const [ops, setOps] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!open) return;
    const userUuid = user?.uuid;
    const companyUuid = localStorage.getItem('current_company_uuid') || '';
    let query = db.syncQueue
      .where('status')
      .anyOf(['PENDING_SYNC', 'FAILED', 'conflict', 'pending', 'error']);
    if (userUuid) {
      query = query.and((op) => op.user_uuid === userUuid);
    } else if (companyUuid) {
      query = query.and((op) => op.company_uuid === companyUuid);
    }
    const list = await query.sortBy('id');
    setOps(list);
  }, [open, user?.uuid]);

  useEffect(() => {
    load();
    const onData = () => load();
    const onSync = () => load();
    window.addEventListener('yebhe:data-changed', onData);
    window.addEventListener('yebhe:synced', onSync);
    return () => {
      window.removeEventListener('yebhe:data-changed', onData);
      window.removeEventListener('yebhe:synced', onSync);
    };
  }, [load]);

  const handleRetryOne = async (op) => {
    setBusy(true);
    try {
      await syncManager.retry(op.id);
    } finally {
      setBusy(false);
      await refreshPendingCount?.();
      await load();
    }
  };

  const handleRetryAll = async () => {
    setBusy(true);
    try {
      if (syncNow) await syncNow();
    } finally {
      setBusy(false);
      await refreshPendingCount?.();
      await load();
    }
  };

  const handleRemove = async (op) => {
    setBusy(true);
    try {
      await db.syncQueue.delete(op.id);
      // Réconcilier le cache local selon le type d'opération annulée
      const table = ENTITY_TO_TABLE[op.entity_type];
      if (table && op.entity_uuid) {
        try {
          const collection = db[table].where('uuid').equals(op.entity_uuid);
          if (op.operation_type === 'DELETE') {
            await collection.modify({ is_deleted: false, updated_at: new Date().toISOString() });
          } else if (op.operation_type === 'CREATE') {
            await collection.modify({ is_deleted: true, updated_at: new Date().toISOString() });
          }
        } catch (err) {
          console.warn('[PWA] Impossible de réconcilier le cache:', err);
        }
      }
      window.dispatchEvent(new CustomEvent('yebhe:data-changed', { detail: { entity_type: op.entity_type } }));
    } finally {
      setBusy(false);
      await refreshPendingCount?.();
      await load();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-900">
            <UploadCloud size={22} className="text-amber-600" />
            <h2 className="text-lg font-bold">Opérations en attente</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {ops.length === 0 ? (
            <div className="text-center text-gray-500 py-8">Aucune opération en attente.</div>
          ) : (
            ops.map((op) => (
              <div key={op.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 capitalize">{op.entity_type}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                        {labels[op.operation_type] || op.operation_type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        op.status === 'conflict' ? 'bg-red-100 text-red-700' :
                        op.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {statusLabels[op.status] || op.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate">{opSummary(op)}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(op.created_at)}</p>
                    {op.last_error && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {op.last_error}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleRetryOne(op)}
                      disabled={busy}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
                    >
                      <RefreshCw size={14} />
                      Réessayer
                    </button>
                    <button
                      onClick={() => handleRemove(op)}
                      disabled={busy}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-between items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
          >
            Fermer
          </button>
          <button
            onClick={handleRetryAll}
            disabled={busy || ops.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Tout synchroniser
          </button>
        </div>
      </div>
    </div>
  );
}
