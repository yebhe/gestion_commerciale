import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Home, ShoppingCart, Building2, Store } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { APPS, getVisibleApps } from '../../config/appsCatalog';

/**
 * Sidebar desktop : liste toutes les "applications" (modules métier) du
 * catalogue central de permissions (_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt).
 * Un clic sur une application affiche ses sous-sections en grandes icônes
 * dans le contenu principal (voir Dashboard.jsx), via le paramètre ?app=.
 * `showSettings` masque en plus "Paramètres" pour les rôles qui n'ont pas
 * settings.view (ex: Manager, Caissier).
 */
const Sidebar = ({ showSettings = true, mobile = false }) => {
  const { hasPermission, user, company, assignedStore } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const activeApp = location.pathname === '/dashboard' ? searchParams.get('app') : null;

  const apps = getVisibleApps(APPS, { hasPermission, isSuperAdmin: user?.is_superuser })
    .filter((app) => app.key !== 'settings' || showSettings);

  const linkClass = (isActive) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg text-[15px] font-medium transition-colors ${
      isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <aside className={`${mobile ? 'flex' : 'hidden md:flex'} flex-col w-64 bg-white border-r border-gray-200 h-screen ${mobile ? '' : 'sticky top-0'}`}>
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2 text-gray-900">
          <Building2 size={20} className="text-primary-600 flex-shrink-0" />
          <span className="font-semibold text-[15px] truncate">{company?.name || 'Entreprise'}</span>
        </div>
        {assignedStore && (
          <div className="flex items-center gap-2 text-gray-500 mt-1">
            <Store size={16} className="flex-shrink-0" />
            <span className="text-sm truncate">{assignedStore.name}</span>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <Link to="/dashboard" className={linkClass(location.pathname === '/dashboard' && !activeApp)}>
          <Home size={26} strokeWidth={2} />
          <span>Tableau de bord</span>
        </Link>

        {hasPermission('pos.access') && (
          <Link to="/pos" className={linkClass(location.pathname === '/pos')}>
            <ShoppingCart size={26} strokeWidth={2} />
            <span>Caisse</span>
          </Link>
        )}

        {apps.map((app) => (
          <Link
            key={app.key}
            to={`/dashboard?app=${app.key}`}
            className={linkClass(activeApp === app.key)}
          >
            <app.icon size={26} strokeWidth={2} />
            <span>{app.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
