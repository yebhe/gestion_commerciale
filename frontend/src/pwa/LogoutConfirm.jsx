/**
 * Modal d'avertissement avant déconnexion.
 *
 * (_docs/11_MODULE_PWA.txt, section "AVERTISSEMENT AVANT DÉCONNEXION")
 *
 * Si des opérations non synchronisées existent, affiche :
 * "Des opérations sont en attente de synchronisation.
 *  Si vous vous déconnectez maintenant,
 *  elles resteront enregistrées sur cet appareil
 *  jusqu'à leur synchronisation.
 *  Voulez-vous continuer ?"
 *
 * Boutons : Annuler / Se déconnecter
 */
import { AlertTriangle, X } from 'lucide-react';

export default function LogoutConfirm({ open, pendingCount, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md p-6 animate-slide-up">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted hover:bg-gray-100 transition-colors"
          aria-label="Fermer"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={24} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Opérations en attente
            </h3>
            <p className="text-muted text-sm leading-relaxed">
              Des opérations sont en attente de synchronisation
              {pendingCount > 0 && (
                <strong className="text-foreground"> ({pendingCount})</strong>
              )}.
              <br />
              Si vous vous déconnectez maintenant,
              elles resteront enregistrées sur cet appareil
              jusqu'à leur synchronisation.
            </p>
            <p className="text-muted text-sm mt-2">
              Voulez-vous continuer ?
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
