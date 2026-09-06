/**
 * Modal de blocage de changement d'utilisateur.
 *
 * (_docs/11_MODULE_PWA.txt, section "BLOCAGE DE CHANGEMENT D'UTILISATEUR")
 *
 * Si des ventes non synchronisées existent pour un utilisateur précédent,
 * aucun autre utilisateur ne peut ouvrir une session sur le même appareil.
 *
 * Affiche :
 * "Des ventes non synchronisées sont encore présentes sur cet appareil.
 *  Veuillez synchroniser les données avant de changer d'utilisateur."
 */
import { Lock, X, RefreshCw } from 'lucide-react';

export default function UserChangeBlock({ open, pendingCount, onRetrySync, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <Lock size={24} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Changement d'utilisateur bloqué
            </h3>
            <p className="text-muted text-sm leading-relaxed">
              Des ventes non synchronisées
              {pendingCount > 0 && (
                <strong className="text-foreground"> ({pendingCount})</strong>
              )}{" "}
              sont encore présentes sur cet appareil.
              <br />
              Veuillez synchroniser les données avant de changer d'utilisateur.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onRetrySync}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={18} />
            Synchroniser maintenant
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-gray-50 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
