import { Search, ShieldCheck } from 'lucide-react';
import Loader from '../../../contexts/Loader';

const SystemRolesList = ({ roles, loading, search, onSearchChange }) => {
  const systemRoles = roles.filter((r) => r.is_system);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted text-lg">{systemRoles.length} rôle(s) système</p>
      </div>

      <div className="relative mb-4">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher un rôle système..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {loading ? (
        <Loader fullscreen={false} />
      ) : systemRoles.length === 0 ? (
        <p className="text-muted text-lg">Aucun rôle système.</p>
      ) : (
        <ul className="divide-y divide-border bg-surface rounded-2xl border border-border">
          {systemRoles.map((role) => (
            <li key={role.uuid} className="py-4 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={26} className="text-primary-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-lg">
                      {role.name}
                      <span className="inline-block text-sm px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 ml-2">Système</span>
                      <span className={`inline-block text-sm px-2 py-0.5 rounded-full ml-1 ${
                        role.scope === 'COMPANY' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {role.scope === 'COMPANY' ? 'Entreprise' : 'Magasin'}
                      </span>
                    </p>
                    {role.description && (
                      <p className="text-base text-muted">{role.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {role.permissions && role.permissions.length > 0 && (
                <div className="mt-3 pl-9">
                  <p className="text-sm font-medium text-muted mb-1">Permissions ({role.permissions.length}) :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions.map((perm) => (
                      <span key={perm.code} className="inline-block text-sm px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600">
                        {perm.name || perm.code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SystemRolesList;
