/**
 * Bannière d'installation PWA — affichée uniquement quand l'installation
 * est possible, jamais de manière intrusive.
 *
 * (_docs/11_MODULE_PWA.txt, section "Installation")
 */
import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePWA } from './PWAContext';

export default function InstallPrompt() {
  const { canInstall, isInstalled, promptInstall } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || isInstalled || dismissed) return null;

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (!accepted) setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-slide-up">
      <div className="bg-surface rounded-2xl shadow-xl border border-border p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
          <Download size={20} className="text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">Installer YEBHE</p>
          <p className="text-muted text-xs mt-0.5">
            Accédez à l'application depuis votre écran d'accueil.
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors flex-shrink-0"
        >
          Installer
        </button>
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
