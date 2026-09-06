/**
 * Bannière de mise à jour PWA — notifie l'utilisateur qu'une nouvelle
 * version est disponible. Ne recharge jamais automatiquement.
 *
 * (_docs/11_MODULE_PWA.txt, section "Mises à jour")
 */
import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { usePWA } from './PWAContext';

export default function UpdateBanner() {
  const { updateAvailable, offlineReady, applyUpdate } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (updateAvailable) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
        <div className="bg-primary-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg">
          <RefreshCw size={20} className="flex-shrink-0" />
          <p className="flex-1 text-sm font-medium">
            Une nouvelle version est disponible.
          </p>
          <button
            onClick={applyUpdate}
            className="px-4 py-1.5 rounded-lg bg-white text-primary-700 text-sm font-semibold hover:bg-primary-50 transition-colors flex-shrink-0"
          >
            Mettre à jour
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg hover:bg-primary-700 transition-colors flex-shrink-0"
            aria-label="Plus tard"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
        <div className="bg-surface rounded-2xl shadow-xl border border-border px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
            <RefreshCw size={16} className="text-green-600" />
          </div>
          <p className="text-sm text-foreground">
            L'application est prête à fonctionner hors ligne.
          </p>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-muted hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
