import { useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-orange-50 border-orange-200 text-orange-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const ICON_COLORS = {
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-orange-600',
  info: 'text-blue-600',
};

/**
 * Notification personnalisée conforme au design de l'application.
 * Remplace alert() et les pop-ups natifs du navigateur.
 * (_docs/09_REGLES_CRUD.txt — section POP-UPS ET NOTIFICATIONS)
 */
const Toast = ({ toast, onClose, duration = 4000 }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => onClose(), duration);
    return () => clearTimeout(timer);
  }, [toast, onClose, duration]);

  if (!toast) return null;

  const Icon = ICONS[toast.type] || Info;

  return (
    <div className="fixed top-4 right-4 z-[60] animate-in fade-in slide-in-from-top-4 duration-300">
      <div
        className={`flex items-start gap-3 rounded-xl border shadow-lg px-5 py-4 max-w-sm ${STYLES[toast.type] || STYLES.info}`}
      >
        <Icon size={26} className={`flex-shrink-0 mt-0.5 ${ICON_COLORS[toast.type] || ICON_COLORS.info}`} />
        <div className="flex-1">
          <p className="text-base font-semibold leading-snug">{toast.title}</p>
          {toast.message && (
            <p className="text-sm mt-0.5 opacity-90">{toast.message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5"
          aria-label="Fermer"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
