import { useEffect, useState } from 'react';
import { AlertTriangle, X, RefreshCw, Trash2 } from 'lucide-react';
import { usePWA } from './PWAContext';
import syncManager from './syncManager';
import db from './db';

function formatError(error) {
  if (!error) return 'Erreur inconnue.';
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export default function SyncConflicts() {
  const { syncResult, clearSyncResult, syncNow } = usePWA();
  const [open, setOpen] = useState(false);
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    if (syncResult?.conflicts?.length > 0) {
      setConflicts(syncResult.conflicts);
      setOpen(true);
    }
  }, [syncResult]);

  const handleClose = () => {
    setOpen(false);
    clearSyncResult();
  };

  const handleRetry = async (opId) => {
    try {
      await syncManager.retry(opId);
      if (syncNow) await syncNow();
    } catch (err) {
      console.error('[PWA] Retry conflict failed:', err);
    }
    setConflicts((prev) => prev.filter((c) => c.op?.id !== opId));
  };

  const handleDiscard = async (opId) => {
    try {
      if (opId) await db.syncQueue.delete(opId);
    } catch (err) {
      console.error('[PWA] Discard conflict failed:', err);
    }
    setConflicts((prev) => prev.filter((c) => c.op?.id !== opId));
  };

  if (!open || conflicts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={22} />
            <h2 className="text-lg font-bold text-foreground">Conflits de synchronisation</h2>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-gray-100 text-muted">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          <p className="text-sm text-muted mb-2">
            Certaines opérations hors ligne n'ont pas pu être synchronisées avec le serveur.
          </p>
          {conflicts.map((conflict) => {
            const op = conflict.op || {};
            return (
              <div key={op.id || Math.random()} className="rounded-xl border border-red-100 bg-red-50/50 p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-foreground">
                    {op.entity_type || 'Opération'} — {op.operation_type || '?'}
                  </p>
                </div>
                <p className="text-sm text-red-700 mb-3">
                  {formatError(conflict.error)}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRetry(op.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
                  >
                    <RefreshCw size={16} />
                    Réessayer
                  </button>
                  <button
                    onClick={() => handleDiscard(op.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200"
                  >
                    <Trash2 size={16} />
                    Ignorer
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-border flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
