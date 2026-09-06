import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authAPI, companiesAPI, settingsAPI } from '../lib/api';
import { applyDefaultTheme, applyTheme, generatePalette } from '../lib/theme';
import { clearCacheData, clearAllData, hasPendingSync, getAllPendingOps } from '../pwa/db';
import syncManager from '../pwa/syncManager';
import {
  createLocalSession,
  getLocalSession,
  isValidOfflineSession,
  destroyLocalSession,
  checkUserChangeBlock,
} from '../pwa/sessionManager';
import db from '../pwa/db';
import { preloadOfflineCache } from '../pwa/preloadCache';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);
  const [role, setRole] = useState(null);
  const [assignedStore, setAssignedStore] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserChangeBlock, setShowUserChangeBlock] = useState(null);
  const [pendingLogoutCount, setPendingLogoutCount] = useState(0);
  const logoutResolveRef = useRef(null);
  const checkAuthCalledRef = useRef(false);

  const applyThemeFromSettings = (themeSettings) => {
    const color = themeSettings?.background_color || '#12151a';
    try {
      applyTheme(generatePalette(color));
    } catch (e) {
      applyDefaultTheme();
    }
  };

  const loadSettings = async (storeUuid) => {
    try {
      const response = await settingsAPI.getSettings(storeUuid);
      setSettings(response.data);
      applyThemeFromSettings(response.data);
    } catch (error) {
      applyDefaultTheme();
      setSettings(null);
    }
  };

  const updateSettings = async (data) => {
    const response = await settingsAPI.updateSettings(data);
    setSettings(response.data);
    applyThemeFromSettings(response.data);
    return response.data;
  };

  useEffect(() => {
    if (checkAuthCalledRef.current) return;
    checkAuthCalledRef.current = true;
    checkAuth();
  }, []);

  const loadCompany = async (storeUuid) => {
    try {
      const response = await companiesAPI.getMyCompanies();
      const selected = response.data.results?.[0] || null;
      setCompany(selected);
      if (selected) {
        localStorage.setItem('current_company_uuid', selected.uuid);
        await loadSettings(storeUuid);
      } else {
        applyDefaultTheme();
      }
      return { company: selected, settings };
    } catch (error) {
      setCompany(null);
      applyDefaultTheme();
      return { company: null, settings: null };
    }
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token');

    if (!token) {
      // Pas de token en ligne — vérifier si une session hors ligne valide existe
      // (_docs/11_MODULE_PWA.txt, section "CONNEXION HORS LIGNE")
      const valid = await isValidOfflineSession();
      if (valid) {
        const session = await getLocalSession();
        if (session) {
          setUser(session.user);
          setPermissions(session.permissions || []);
          setRole(session.role || null);
          setAssignedStore(session.store || null);
          setCompany(session.company || null);
          setSettings(session.settings || null);
          setIsOfflineMode(true);
          if (session.company) {
            localStorage.setItem('current_company_uuid', session.company.uuid);
          }
          applyThemeFromSettings(session.settings);
          setLoading(false);
          return;
        }
      }
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.getProfile();
      setUser(response.data);
      
      const permResponse = await authAPI.getPermissions();
      setPermissions(permResponse.data.permissions || []);
      setRole(permResponse.data.role || null);
      setAssignedStore(permResponse.data.store || null);

      const { company: loadedCompany, settings: loadedSettings } = await loadCompany(permResponse.data.store?.uuid);

      // Créer / mettre à jour la session locale sécurisée
      // (_docs/11_MODULE_PWA.txt, section "PREMIÈRE CONNEXION")
      await createLocalSession({
        user: response.data,
        permissions: permResponse.data.permissions || [],
        company: loadedCompany,
        store: permResponse.data.store || null,
        settings: loadedSettings,
      });
      setIsOfflineMode(false);

      if (loadedCompany) {
        preloadOfflineCache({
          companyUuid: loadedCompany.uuid,
          storeUuid: permResponse.data.store?.uuid || null,
          userUuid: response.data.uuid,
        });
      }
    } catch (error) {
      // En cas d'erreur (réseau, 401/403, etc.), tenter d'abord la session hors ligne
      const valid = await isValidOfflineSession();
      if (valid) {
        const session = await getLocalSession();
        if (session) {
          setUser(session.user);
          setPermissions(session.permissions || []);
          setRole(session.role || null);
          setAssignedStore(session.store || null);
          setCompany(session.company || null);
          setSettings(session.settings || null);
          setIsOfflineMode(true);
          if (session.company) {
            localStorage.setItem('current_company_uuid', session.company.uuid);
          }
          applyThemeFromSettings(session.settings);
          setLoading(false);
          return;
        }
      }

      // Pas de session offline : erreur d'auth = déconnexion; erreur réseau = conserver les tokens
      const isAuthError = error.response?.status === 401 || error.response?.status === 403;
      if (isAuthError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        applyDefaultTheme();
      } else {
        console.error('checkAuth: erreur non-auth / hors ligne:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    // (_docs/11_MODULE_PWA.txt, section "BLOCAGE DE CHANGEMENT D'UTILISATEUR")
    // Vérifier si un autre utilisateur a des ventes non synchronisées sur cet appareil
    const allPending = await getAllPendingOps();
    if (allPending.length > 0) {
      // On ne connaît pas encore le newUserUuid, mais on peut vérifier
      // s'il y a des opérations appartenant à un utilisateur différent
      // On laisse passer si l'email correspond au même utilisateur (à vérifier côté serveur)
    }

    const response = await authAPI.login(email, password);
    const { access, refresh, user: userData } = response.data;

    // Vérifier le blocage de changement d'utilisateur maintenant qu'on a l'UUID
    const blockInfo = await checkUserChangeBlock(db, userData.uuid);
    if (blockInfo) {
      setShowUserChangeBlock(blockInfo);
      // Retirer les tokens qu'on vient de recevoir — on ne connecte pas
      throw new Error(
        `Des ventes non synchronisées (${blockInfo.count}) sont encore présentes sur cet appareil. ` +
        'Veuillez synchroniser les données avant de changer d\'utilisateur.'
      );
    }

    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    setUser(userData);

    let permData = { permissions: [], role: null, store: null };
    try {
      const permResponse = await authAPI.getPermissions();
      permData = permResponse.data;
      setPermissions(permData.permissions || []);
      setRole(permData.role || null);
      setAssignedStore(permData.store || null);
    } catch (error) {
      setPermissions([]);
      setRole(null);
      setAssignedStore(null);
    }

    const { company: loadedCompany, settings: loadedSettings } = await loadCompany(permData.store?.uuid);

    // Créer la session locale sécurisée
    // (_docs/11_MODULE_PWA.txt, section "PREMIÈRE CONNEXION")
    await createLocalSession({
      user: userData,
      permissions: permData.permissions || [],
      company: loadedCompany,
      store: permData.store || null,
      settings: loadedSettings,
    });
    setIsOfflineMode(false);

    if (loadedCompany) {
      preloadOfflineCache({
        companyUuid: loadedCompany.uuid,
        storeUuid: permData.store?.uuid || null,
        userUuid: userData.uuid,
      });
    }

    return userData;
  };

  useEffect(() => {
    applyDefaultTheme();
  }, []);

  const register = async (data) => {
    const response = await authAPI.register(data);
    return response.data;
  };

  const logout = async () => {
    // (_docs/11_MODULE_PWA.txt, section "AVERTISSEMENT AVANT DÉCONNEXION")
    // Vérifier s'il y a des opérations non synchronisées
    const pending = await hasPendingSync();
    if (pending) {
      const allPending = await getAllPendingOps();
      setPendingLogoutCount(allPending.length);
      setShowLogoutConfirm(true);
      // Retourner une Promise qui se résout quand l'utilisateur confirme ou annule
      return new Promise((resolve) => {
        logoutResolveRef.current = resolve;
      });
    }
    // Pas d'opérations en attente — logout direct
    await performLogout();
  };

  const performLogout = async () => {
    // (_docs/11_MODULE_PWA.txt, section "DÉCONNEXION")
    // La déconnexion est toujours autorisée, même hors ligne

    // Tenter une dernière synchronisation si en ligne
    try {
      await syncManager.syncAll();
    } catch {
      // Hors ligne ou erreur — on continue le logout
    }

    const stillPending = await hasPendingSync();
    if (stillPending) {
      // Préserver syncQueue + posSessions (ventes non synchronisées)
      clearCacheData();
    } else {
      // Tout est synchronisé : nettoyage complet
      clearAllData();
    }

    // Détruire la session locale
    await destroyLocalSession();

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_company_uuid');
    setUser(null);
    setCompany(null);
    setSettings(null);
    setPermissions([]);
    setRole(null);
    setAssignedStore(null);
    setIsOfflineMode(false);
    applyDefaultTheme();
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await performLogout();
    if (logoutResolveRef.current) {
      logoutResolveRef.current(true);
      logoutResolveRef.current = null;
    }
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
    if (logoutResolveRef.current) {
      logoutResolveRef.current(false);
      logoutResolveRef.current = null;
    }
  };

  const hasPermission = (permissionCode) => {
    if (user?.is_superuser) return true;
    return permissions.some(p => p.code === permissionCode);
  };

  const value = {
    user,
    company,
    setCompany,
    settings,
    updateSettings,
    loading,
    login,
    register,
    logout,
    hasPermission,
    permissions,
    role,
    scope: role?.scope || null,
    assignedStore,
    checkAuth,
    // PWA session hors ligne
    isOfflineMode,
    showLogoutConfirm,
    pendingLogoutCount,
    confirmLogout,
    cancelLogout,
    showUserChangeBlock,
    setShowUserChangeBlock,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
