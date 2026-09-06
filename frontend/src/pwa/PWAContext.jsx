/**
 * Contexte PWA — unifie tous les gestionnaires (réseau, sync, install, update)
 * en un seul provider React accessible via usePWA().
 *
 * (_docs/11_MODULE_PWA.txt, section "Architecture")
 */
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import networkManager from './networkManager';
import syncManager from './syncManager';
import installManager from './installManager';
import { initUpdateManager } from './updateManager';
import { clearAllData, clearCompanyData, clearCacheData } from './db';
import { preloadOfflineCache } from './preloadCache';

const PWAContext = createContext(null);

export const PWAProvider = ({ children }) => {
  const [network, setNetwork] = useState(networkManager.getState());
  const wasOnlineRef = useRef(network.online);
  const [canInstall, setCanInstall] = useState(installManager.canInstall);
  const [isInstalled, setIsInstalled] = useState(installManager.isInstalled);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    // Réseau
    const onNetworkChange = (e) => setNetwork(e.detail);
    networkManager.addEventListener('change', onNetworkChange);
    networkManager.startLatencyPolling();

    // Vérifications immédiates dès que la fenêtre reprend le focus ou devient visible
    const onWindowFocus = () => networkManager.checkNow();
    const onVisibility = () => { if (!document.hidden) networkManager.checkNow(); };
    const onOnline = () => networkManager.checkNow();
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);

    // Installation
    const onCanInstall = () => setCanInstall(true);
    const onInstalled = () => { setIsInstalled(true); setCanInstall(false); };
    const onDismissed = () => setCanInstall(false);
    installManager.addEventListener('canInstall', onCanInstall);
    installManager.addEventListener('installed', onInstalled);
    installManager.addEventListener('dismissed', onDismissed);

    // Mise à jour
    const um = initUpdateManager();
    const onUpdate = () => setUpdateAvailable(true);
    const onOffline = () => setOfflineReady(true);
    um.addEventListener('updateAvailable', onUpdate);
    um.addEventListener('offlineReady', onOffline);

    // Synchronisation
    const onSyncStart = () => setSyncing(true);
    const onSyncEnd = (e) => {
      setSyncing(false);
      setSyncResult(e.detail);
      window.dispatchEvent(new CustomEvent('yebhe:synced', { detail: e.detail }));
      if (network.online) {
        refreshPendingCount();
      }
    };
    const onEnqueued = () => refreshPendingCount();
    syncManager.addEventListener('syncStart', onSyncStart);
    syncManager.addEventListener('syncEnd', onSyncEnd);
    syncManager.addEventListener('enqueued', onEnqueued);

    // Auto-sync au retour de la connexion (transition offline -> online uniquement)
    const onNetworkChangeAutoSync = (e) => {
      if (e.detail.online && !wasOnlineRef.current) {
        const companyUuid = localStorage.getItem('current_company_uuid') || '';
        Promise.resolve(syncManager.syncAll())
          .catch(() => {})
          .finally(() => { if (companyUuid) preloadOfflineCache({ companyUuid }); });
      }
      wasOnlineRef.current = e.detail.online;
    };
    networkManager.addEventListener('change', onNetworkChangeAutoSync);

    return () => {
      networkManager.removeEventListener('change', onNetworkChange);
      networkManager.removeEventListener('change', onNetworkChangeAutoSync);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
      networkManager.stopLatencyPolling();
      installManager.removeEventListener('canInstall', onCanInstall);
      installManager.removeEventListener('installed', onInstalled);
      installManager.removeEventListener('dismissed', onDismissed);
      um.removeEventListener('updateAvailable', onUpdate);
      um.removeEventListener('offlineReady', onOffline);
      syncManager.removeEventListener('syncStart', onSyncStart);
      syncManager.removeEventListener('syncEnd', onSyncEnd);
      syncManager.removeEventListener('enqueued', onEnqueued);
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const pending = await syncManager.getPending(
      localStorage.getItem('current_company_uuid') || ''
    );
    setPendingCount(pending.length);
  }, []);

  const promptInstall = useCallback(async () => {
    return installManager.promptInstall();
  }, []);

  const applyUpdate = useCallback(() => {
    const um = initUpdateManager();
    um.applyUpdate();
  }, []);

  const syncNow = useCallback(async () => {
    try { await syncManager.syncAll(); } catch (err) { console.error('Sync error:', err); }
  }, []);

  const clearSyncResult = useCallback(() => setSyncResult(null), []);

  const clearLocalData = useCallback(async (companyUuid) => {
    if (companyUuid) {
      await clearCompanyData(companyUuid);
    } else {
      await clearAllData();
    }
    setPendingCount(0);
  }, []);

  const value = {
    // Réseau
    online: network.online,
    networkStatus: network.status,
    connection: network.connection,
    latency: network.latency,

    // Installation
    canInstall,
    isInstalled,
    promptInstall,

    // Mise à jour
    updateAvailable,
    offlineReady,
    applyUpdate,

    // Synchronisation
    syncing,
    pendingCount,
    syncResult,
    syncNow,
    clearSyncResult,
    refreshPendingCount,

    // Données locales
    clearLocalData,
  };

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
};

export const usePWA = () => {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error('usePWA must be used within PWAProvider');
  return ctx;
};
