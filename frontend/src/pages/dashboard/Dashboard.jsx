import { useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { APPS, getVisibleApps } from '../../config/appsCatalog';
import CompaniesModule from './CompaniesModule';
import SettingsModule from './settings';
import StoresModule from './stores';
import ProductsModule from './products';
import EmployeesModule from './employees';
import InventoryModule from './inventory';
import CustomersModule from './customers';
import SuppliersModule from './suppliers';
import SalesModule from './sales';
import FilesModule from './files';
import AuditModule from './audit';
import ReportsModule from './reports';

/**
 * Grande tuile cliquable : icône imposante + libellé court, pensée pour un
 * public peu à l'aise avec l'écrit (facile, conviviale, peu de texte).
 */
const BigTile = ({ label, icon: Icon, onClick, available = true, color = 'primary' }) => {
  const colorClasses = available
    ? color === 'primary'
      ? 'bg-primary-50 text-primary-700 hover:bg-primary-100'
      : 'bg-white text-gray-700 hover:border-primary-400 hover:shadow-md'
    : 'bg-gray-50 text-gray-400 cursor-not-allowed';

  return (
    <button
      type="button"
      onClick={available ? onClick : undefined}
      disabled={!available}
      className={`relative flex flex-col items-center justify-center gap-3 aspect-square rounded-2xl border border-gray-100 shadow-sm p-2 transition-all active:scale-95 ${colorClasses}`}
    >
      <Icon size={44} strokeWidth={1.75} />
      <span className="text-[15px] font-semibold text-center leading-tight">{label}</span>
      {!available && (
        <span className="absolute top-2 right-2 text-[11px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
          Bientôt
        </span>
      )}
    </button>
  );
};

/**
 * Dashboard unique et modulaire (_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt,
 * section "ARCHITECTURE DASHBOARD") : une seule route /dashboard. La
 * Sidebar liste toutes les applications autorisées ; un clic sur une
 * application affiche ses sous-sections en grandes icônes ici (interface
 * conviviale, peu de texte, pensée pour un public peu à l'aise avec
 * l'écrit). Aucune application ou sous-section n'est affichée sans la
 * permission correspondante.
 */
const Dashboard = () => {
  const { user, hasPermission, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeAppKey = searchParams.get('app');
  const activeSub = searchParams.get('sub');

  const isSuperAdmin = Boolean(user?.is_superuser);
  const apps = getVisibleApps(APPS, { hasPermission, isSuperAdmin });
  const activeApp = apps.find((app) => app.key === activeAppKey) || null;

  const roleLabel = isSuperAdmin ? 'Super Admin' : role?.name;

  const openApp = (key) => setSearchParams({ app: key });
  const goHome = () => setSearchParams({});

  return (
    <DashboardLayout roleLabel={roleLabel} showSettings={hasPermission('settings.view') || hasPermission('company.view')}>
      {activeApp ? (
        <>
          <button
            type="button"
            onClick={goHome}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 font-medium mb-4"
          >
            <ArrowLeft size={20} />
            Retour
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <activeApp.icon size={28} className="text-primary-600" />
            {activeApp.label}
          </h1>

          {activeApp.isPlatform ? (
            <CompaniesModule />
          ) : activeApp.key === 'settings' && activeSub ? (
            <SettingsModule
              sub={activeSub}
              onBack={() => setSearchParams({ app: activeApp.key })}
            />
          ) : activeApp.key === 'stores' ? (
            <StoresModule />
          ) : activeApp.key === 'employees' && activeSub ? (
            <EmployeesModule
              sub={activeSub}
              onBack={() => setSearchParams({ app: activeApp.key })}
            />
          ) : activeApp.key === 'products' && activeSub ? (
            <ProductsModule
              sub={activeSub}
              onBack={() => setSearchParams({ app: activeApp.key })}
            />
          ) : activeApp.key === 'inventory' && activeSub ? (
            <InventoryModule
              sub={activeSub}
              onBack={() => setSearchParams({ app: activeApp.key })}
            />
          ) : activeApp.key === 'customers' ? (
            <CustomersModule />
          ) : activeApp.key === 'suppliers' ? (
            <SuppliersModule />
          ) : activeApp.key === 'sales' && activeSub ? (
            <SalesModule
              sub={activeSub}
              onBack={() => setSearchParams({ app: activeApp.key })}
            />
          ) : activeApp.key === 'reports' && activeSub ? (
            <ReportsModule
              sub={activeSub}
              onBack={() => setSearchParams({ app: activeApp.key })}
            />
          ) : activeApp.key === 'files' ? (
            <FilesModule />
          ) : activeApp.key === 'audit' ? (
            <AuditModule />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeApp.subsections.map((sub) => (
                <BigTile
                  key={sub.key}
                  label={sub.label}
                  icon={sub.icon}
                  available={sub.available}
                  onClick={sub.available ? () => setSearchParams({ app: activeApp.key, sub: sub.key }) : undefined}
                  color="white"
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Tableau de bord</h1>
          <p className="text-gray-500 mb-6">
            Choisissez une application{roleLabel ? ` — ${roleLabel}` : ''}
          </p>

          {apps.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
              Aucune application ne vous a été attribuée. Contactez un
              administrateur pour obtenir des permissions.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {apps.map((app) => (
              <BigTile
                key={app.key}
                label={app.label}
                icon={app.icon}
                onClick={() => openApp(app.key)}
              />
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default Dashboard;
