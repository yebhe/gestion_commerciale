import { Wifi, WifiOff } from 'lucide-react';
import { usePWA } from '../../pwa/PWAContext';

// Indicateur de connexion (_docs/07_UI_UX_DESIGN_GUIDELINES.txt, sections 8 et 12)
// Intégré au PWA networkManager pour la détection hors ligne / connexion lente.
const ConnectionStatus = () => {
  const { online, networkStatus, pendingCount, syncing } = usePWA();

  if (syncing) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
        <Wifi size={18} className="animate-pulse" />
        Synchronisation...
      </div>
    );
  }

  if (!online) {
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

  if (networkStatus === 'slow') {
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
};

export default ConnectionStatus;
