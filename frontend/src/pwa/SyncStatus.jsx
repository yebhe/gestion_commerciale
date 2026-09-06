/**
 * Indicateur de statut de synchronisation — affiche l'état du réseau,
 * les opérations en attente, et la synchronisation en cours.
 *
 * (_docs/11_MODULE_PWA.txt, sections "État du réseau", "Synchronisation")
 */
import { Wifi, WifiOff, RefreshCw, UploadCloud, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { usePWA } from './PWAContext';
import PendingOps from './PendingOps';

export default function SyncStatus() {
  const { online, networkStatus, syncing, pendingCount, syncResult } = usePWA();
  const [showPending, setShowPending] = useState(false);

  const isOffline = !online;
  const isSlow = networkStatus === 'slow';
  const hasConflicts = syncResult?.conflicts?.length > 0;

  if (isOffline) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-orange-50 text-orange-700">
        <WifiOff size={18} />
        Hors ligne
        {pendingCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-200 text-orange-800 text-xs font-bold">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  if (syncing) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
        <RefreshCw size={18} className="animate-spin" />
        Synchronisation...
      </div>
    );
  }

  if (hasConflicts) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-red-50 text-red-700">
        <AlertTriangle size={18} />
        Conflit de sync
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <>
        <button
          onClick={() => setShowPending(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <UploadCloud size={18} />
          {pendingCount} en attente
        </button>
        <PendingOps open={showPending} onClose={() => setShowPending(false)} />
      </>
    );
  }

  if (isSlow) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-yellow-50 text-yellow-700">
        <Wifi size={18} />
        Connexion lente
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-green-50 text-green-700">
      <Wifi size={18} />
      Connecté
    </div>
  );
}
