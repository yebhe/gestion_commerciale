export { PWAProvider, usePWA } from './PWAContext';
export { default as InstallPrompt } from './InstallPrompt';
export { default as UpdateBanner } from './UpdateBanner';
export { default as SyncStatus } from './SyncStatus';
export { default as SyncOverlay } from './SyncOverlay';
export { default as SyncConflicts } from './SyncConflicts';
export { default as PendingOps } from './PendingOps';
export { default as LogoutConfirm } from './LogoutConfirm';
export { default as UserChangeBlock } from './UserChangeBlock';
export { useOfflineCache } from './useOfflineCache';
export { default as useSyncRefresh } from './useSyncRefresh';
// useOfflineMutation est importé directement depuis './pwa/useOfflineMutation'
// pour éviter un import circulaire via index.js → AuthContext → pwa/db
export {
  OFFLINE_MODULES,
  ONLINE_ONLY_MODULES,
  isModuleOffline,
  isOperationOffline,
  isModuleOnlineOnly,
} from './offlineModules';
export { default as db } from './db';
export { default as syncManager } from './syncManager';
export { default as networkManager } from './networkManager';
export {
  preloadOfflineCache,
  loadStoresWithCache,
} from './preloadCache';
export {
  createLocalSession,
  getLocalSession,
  isValidOfflineSession,
  isSessionExpired,
  destroyLocalSession,
  updateLocalSession,
  getDeviceUuid,
  checkUserChangeBlock,
} from './sessionManager';
export {
  clearAllData,
  clearCacheData,
  clearCompanyData,
  hasPendingSync,
  getPendingCountForUser,
  getAllPendingOps,
} from './db';
