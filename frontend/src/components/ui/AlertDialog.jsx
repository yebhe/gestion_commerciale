import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', btn: 'bg-green-600 hover:bg-green-700 text-white' },
  error: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', btn: 'bg-red-600 hover:bg-red-700 text-white' },
  warning: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600', btn: 'bg-orange-600 hover:bg-orange-700 text-white' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', btn: 'bg-primary-600 hover:bg-primary-700 text-white' },
};

const AlertDialog = ({ alert, onClose }) => {
  if (!alert) return null;

  const Icon = ICONS[alert.type] || Info;
  const style = STYLES[alert.type] || STYLES.info;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50">
      <div className={`bg-surface rounded-2xl border ${style.border} shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full ${style.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon size={26} className={style.icon} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-foreground">{alert.title}</h3>
            {alert.message && (
              <p className="text-base text-muted mt-1.5 leading-relaxed">{alert.message}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-xl text-muted hover:text-foreground hover:bg-gray-100"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className={`h-11 px-6 rounded-xl text-base font-semibold ${style.btn}`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertDialog;
