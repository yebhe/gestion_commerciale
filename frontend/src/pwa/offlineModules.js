/**
 * Liste blanche des modules hors ligne et des modules nécessitant Internet.
 *
 * (_docs/13_FONCTIONNALITE_HORS_LIGNE.txt)
 *
 * Utilisé par les composants pour :
 * - autoriser / bloquer certaines fonctionnalités hors ligne ;
 * - afficher un badge "Hors ligne" ou "Internet requis" ;
 * - désactiver les boutons d'action non disponibles hors ligne.
 */

/**
 * Modules autorisés hors ligne avec leurs opérations.
 * (_docs/13, section "MODULES AUTORISÉS HORS LIGNE")
 */
export const OFFLINE_MODULES = {
  products: {
    label: 'Produits',
    operations: ['read', 'create', 'update', 'delete'],
    entity_type: 'product',
  },
  categories: {
    label: 'Catégories',
    operations: ['read', 'create', 'update', 'delete'],
    entity_type: 'category',
  },
  suppliers: {
    label: 'Fournisseurs',
    operations: ['read', 'create', 'update', 'delete'],
    entity_type: 'supplier',
  },
  customers: {
    label: 'Clients',
    operations: ['read', 'create', 'update', 'delete'],
    entity_type: 'customer',
  },
  stock: {
    label: 'Stock',
    operations: ['read', 'entry', 'exit', 'adjust', 'inventory', 'transfer', 'history'],
    entity_type: 'stockMovement',
  },
  pos: {
    label: 'POS',
    operations: ['open', 'close', 'sale', 'add_customer', 'print_receipt', 'view_sales'],
    entity_type: 'sale',
  },
  reports: {
    label: 'Rapports',
    operations: ['local_sales_today', 'local_revenue', 'local_stock'],
    entity_type: null,
    note: "Données locales uniquement — susceptibles d'être incomplètes",
  },
};

/**
 * Modules nécessitant obligatoirement Internet.
 * (_docs/13, section "MODULES NÉCESSITANT INTERNET")
 */
export const ONLINE_ONLY_MODULES = {
  auth_initial: 'Authentification initiale (première connexion)',
  users: 'Gestion des utilisateurs',
  roles: 'Gestion des rôles',
  permissions: 'Gestion des permissions',
  company_settings: "Paramètres de l'entreprise",
  subscriptions: 'Abonnements SaaS',
  billing: 'Facturation SaaS',
  mobile_money: 'Mobile Money',
  platform_admin: 'Administration de la plateforme',
};

/**
 * Vérifie si un module est disponible hors ligne.
 */
export function isModuleOffline(moduleKey) {
  return moduleKey in OFFLINE_MODULES;
}

/**
 * Vérifie si une opération est autorisée hors ligne pour un module.
 */
export function isOperationOffline(moduleKey, operation) {
  const mod = OFFLINE_MODULES[moduleKey];
  if (!mod) return false;
  return mod.operations.includes(operation);
}

/**
 * Vérifie si un module nécessite Internet.
 */
export function isModuleOnlineOnly(moduleKey) {
  return moduleKey in ONLINE_ONLY_MODULES;
}
