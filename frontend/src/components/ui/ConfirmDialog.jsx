import { X, AlertTriangle } from 'lucide-react';

/**
 * Pop-up de confirmation personnalisé conforme à l'UI de l'application.
 * Remplace window.confirm.
 */
const ConfirmDialog = ({
  isOpen,
  title = 'Confirmation',
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  variant = 'danger',
}) => {
  if (!isOpen) return null;

  const confirmColors =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-primary-600 hover:bg-primary-700 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface rounded-xl border border-border shadow-lg w-full max-w-md p-5 animate-in fade-in zoom-in duration-150">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted mt-1">{message}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted hover:text-foreground p-1"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 px-4 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-10 px-4 rounded-lg text-sm font-medium ${confirmColors}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
