import { RefreshCw, Wifi, CheckCircle } from 'lucide-react';
import { usePWA } from './PWAContext';

export default function SyncOverlay() {
  const { syncing, pendingCount } = usePWA();

  if (!syncing) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border p-8 max-w-sm w-[90%] text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mb-4">
          <RefreshCw size={32} className="text-primary-600 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          Synchronisation en cours
        </h2>
        <p className="text-muted text-base mb-4">
          {pendingCount > 0
            ? `${pendingCount} opération${pendingCount > 1 ? 's' : ''} en attente...`
            : 'Envoi des données au serveur...'}
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-green-600">
          <Wifi size={16} />
          <span>Connexion retrouvée</span>
        </div>
      </div>
    </div>
  );
}
