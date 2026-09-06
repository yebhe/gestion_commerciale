import { X } from 'lucide-react';
import { ACTION_STYLES, ACTION_LABELS } from './constants';

const AuditDetail = ({ log, onClose }) => {
  if (!log) return null;

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 mb-6 relative">
      <button type="button" onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
        <X size={24} />
      </button>

      <h2 className="text-xl font-bold text-foreground mb-4">
        Entrée d'audit — {ACTION_LABELS[log.action] || log.action}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm text-muted">Date</p>
          <p className="text-base font-medium text-foreground">
            {new Date(log.created_at).toLocaleString('fr-FR')}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted">Action</p>
          <span className={`inline-block text-sm font-medium px-3 py-1 rounded-full ${ACTION_STYLES[log.action] || 'bg-gray-100 text-gray-600'}`}>
            {ACTION_LABELS[log.action] || log.action}
          </span>
        </div>
        <div>
          <p className="text-sm text-muted">Type d'objet</p>
          <p className="text-base font-medium text-foreground">{log.object_type}</p>
        </div>
        <div>
          <p className="text-sm text-muted">ID de l'objet</p>
          <p className="text-base font-medium text-foreground">{log.object_id}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Utilisateur</p>
          <p className="text-base font-medium text-foreground">
            {log.user?.first_name} {log.user?.last_name || log.user?.email || '—'}
          </p>
        </div>
      </div>

      {log.metadata && Object.keys(log.metadata).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Métadonnées</h3>
          <pre className="bg-gray-50 rounded-xl p-4 text-base text-foreground overflow-x-auto">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AuditDetail;
