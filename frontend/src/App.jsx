import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Loader from './contexts/Loader';
import { PWAProvider, SyncOverlay, SyncConflicts } from './pwa';
import InstallPrompt from './pwa/InstallPrompt';
import UpdateBanner from './pwa/UpdateBanner';
import LogoutConfirm from './pwa/LogoutConfirm';
import UserChangeBlock from './pwa/UserChangeBlock';
import LoginPage from './pages/auth/LoginPage';
import Dashboard from './pages/dashboard/Dashboard';
import POS from './pages/pos/POS';

const DASHBOARD_PATH = '/dashboard';

// Architecture cible (_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt, section
// "ARCHITECTURE DASHBOARD") : un seul dashboard, modulaire selon les
// permissions, + une route dédiée /pos pour la caisse. Le SUPER_ADMIN
// (rôle plateforme, is_superuser) utilise la même route /dashboard : le
// module Compagnies y est simplement affiché comme les autres modules.
function ProtectedRoute({ children, requiredPermission }) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;

  // Route tenant protégée par une permission du catalogue central
  // (_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt), ex: pos.access pour /pos.
  // Le SUPER_ADMIN n'a pas de permissions tenant : il n'accède qu'à /dashboard.
  if (requiredPermission && !user.is_superuser && !hasPermission(requiredPermission)) {
    return <Navigate to={DASHBOARD_PATH} replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <Loader />;
  if (user) return <Navigate to={DASHBOARD_PATH} replace />;

  return children;
}

function App() {
  return (
    <AuthProvider>
      <PWAProvider>
      <Router>
        <SyncOverlay />
        <SyncConflicts />
        <UpdateBanner />
        <InstallPrompt />
        <PWAModals />
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <ProtectedRoute requiredPermission="pos.access">
                <POS />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
      </PWAProvider>
    </AuthProvider>
  );
}

function PWAModals() {
  const { showLogoutConfirm, pendingLogoutCount, confirmLogout, cancelLogout, showUserChangeBlock, setShowUserChangeBlock } = useAuth();

  return (
    <>
      <LogoutConfirm
        open={showLogoutConfirm}
        pendingCount={pendingLogoutCount}
        onConfirm={confirmLogout}
        onCancel={cancelLogout}
      />
      <UserChangeBlock
        open={!!showUserChangeBlock}
        pendingCount={showUserChangeBlock?.count || 0}
        onRetrySync={async () => {
          const { default: syncManager } = await import('./pwa/syncManager');
          await syncManager.syncAll();
          setShowUserChangeBlock(null);
        }}
        onClose={() => setShowUserChangeBlock(null)}
      />
    </>
  );
}

export default App;
