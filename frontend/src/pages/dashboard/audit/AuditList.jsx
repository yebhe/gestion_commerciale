import {
  Search, ChevronLeft, ChevronRight, ScrollText, Eye, X,
} from 'lucide-react';
import Loader from '../../../contexts/Loader';
import { ACTION_STYLES, ACTION_LABELS, btnSecondary } from './constants';

const AuditList = ({
  logs, loading, search, page, count, next, prev,
  onSearchChange, onPageChange, onView,
}) => (
  <>
    <div className="relative mb-4">
      <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Rechercher (action, objet, utilisateur)..."
        className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>

    {loading ? (
      <Loader fullscreen={false} />
    ) : logs.length === 0 ? (
      <div className="bg-primary-50 border border-primary-200 rounded-2xl p-8 text-center">
        <ScrollText size={40} className="text-primary-400 mx-auto mb-3" />
        <p className="text-lg text-muted">Aucune entrée d'audit pour le moment.</p>
      </div>
    ) : (
      <ul className="divide-y divide-border bg-surface rounded-2xl border border-border">
        {logs.map((log) => (
          <li key={log.uuid} className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <ScrollText size={24} className="text-primary-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">
                  {ACTION_LABELS[log.action] || log.action} — {log.object_type}
                </p>
                <p className="text-base text-muted">
                  {new Date(log.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${ACTION_STYLES[log.action] || 'bg-gray-100 text-gray-600'}`}>
                {ACTION_LABELS[log.action] || log.action}
              </span>
              <button onClick={() => onView(log)}
                className="p-2.5 rounded-xl text-muted hover:text-primary-600 hover:bg-primary-50 transition-colors">
                <Eye size={22} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    )}

    {(next || prev) && (
      <div className="flex items-center justify-between mt-6">
        <p className="text-muted text-base">{count} entrée(s) au total</p>
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))} disabled={!prev}
            className={`${btnSecondary} ${!prev ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <ChevronLeft size={20} />
            Précédent
          </button>
          <span className="text-base font-medium text-foreground">Page {page}</span>
          <button type="button"
            onClick={() => onPageChange(page + 1)} disabled={!next}
            className={`${btnSecondary} ${!next ? 'opacity-40 cursor-not-allowed' : ''}`}>
            Suivant
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    )}
  </>
);

export default AuditList;
