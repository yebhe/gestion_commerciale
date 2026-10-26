/**
 * IndexedDB locale via Dexie — isolation multi-tenant + traçabilité utilisateur.
 *
 * (_docs/11_MODULE_PWA.txt, _docs/13_FONCTIONNALITE_HORS_LIGNE.txt)
 *
 * Toutes les stores contiennent company_uuid, store_uuid, user_uuid, device_uuid
 * pour garantir l'isolation et la traçabilité des opérations hors ligne.
 *
 * États des opérations (_docs/11_MODULE_PWA.txt + _docs/13_FONCTIONNALITE_HORS_LIGNE.txt) :
 *   PENDING_SYNC — en attente de synchronisation
 *   SYNCING      — synchronisation en cours
 *   SYNCED       — synchronisée avec le serveur (supprimée de la file)
 *   FAILED       — échec de synchronisation
 *   conflict     — conflit détecté (409), résolution utilisateur requise
 *
 * Types d'opérations (_docs/13, section "TYPES D'OPÉRATIONS") :
 *   CREATE — création d'une entité
 *   UPDATE — modification d'une entité
 *   DELETE — suppression (Soft Delete)
 *
 * Ne jamais stocker : mots de passe, secrets, clés privées, tokens,
 * données bancaires (_docs/11_MODULE_PWA.txt, section "SÉCURITÉ").
 */
import Dexie from 'dexie';

const DB_NAME = 'yebhe-pwa';
const DB_VERSION = 6;

const db = new Dexie(DB_NAME);

db.version(1).stores({
  products:    'uuid, company_uuid, store_uuid, name, updated_at',
  categories:  'uuid, company_uuid, store_uuid, name, updated_at',
  customers:   'uuid, company_uuid, name, updated_at',
  suppliers:   'uuid, company_uuid, name, updated_at',
  stores:      'uuid, company_uuid, name, updated_at',
  settings:    'key, company_uuid, updated_at',
  syncQueue:   '++id, company_uuid, store_uuid, entity, operation, status, created_at',
  syncLog:     '++id, company_uuid, entity, operation, status, message, created_at',
  posSessions: 'uuid, company_uuid, store_uuid, status, created_at',
  preferences: 'key, company_uuid',
});

db.version(3).stores({
  products:    'uuid, company_uuid, store_uuid, user_uuid, device_uuid, name, updated_at',
  categories:  'uuid, company_uuid, store_uuid, user_uuid, device_uuid, name, updated_at',
  customers:   'uuid, company_uuid, user_uuid, device_uuid, name, updated_at',
  suppliers:   'uuid, company_uuid, user_uuid, device_uuid, name, updated_at',
  stores:      'uuid, company_uuid, user_uuid, device_uuid, name, updated_at',
  settings:    'key, company_uuid, user_uuid, device_uuid, updated_at',
  syncQueue:   '++id, operation_uuid, company_uuid, store_uuid, user_uuid, device_uuid, entity_type, entity_uuid, operation_type, status, created_at, synced_at',
  syncLog:     '++id, company_uuid, store_uuid, user_uuid, device_uuid, entity_type, operation_type, status, message, created_at',
  posSessions: 'uuid, company_uuid, store_uuid, user_uuid, device_uuid, status, created_at',
  stockMovements: 'uuid, company_uuid, store_uuid, user_uuid, device_uuid, product_uuid, movement_type, status, created_at',
  preferences: 'key, company_uuid, user_uuid, device_uuid',
});

db.version(DB_VERSION).stores({
  // Cache de données métier (lecture hors ligne)
  products:    'uuid, company_uuid, store_uuid, user_uuid, device_uuid, name, updated_at',
  categories:  'uuid, company_uuid, store_uuid, user_uuid, device_uuid, name, updated_at',
  customers:   'uuid, company_uuid, user_uuid, device_uuid, name, updated_at',
  suppliers:   'uuid, company_uuid, user_uuid, device_uuid, name, updated_at',
  stores:      'uuid, company_uuid, user_uuid, device_uuid, name, updated_at',
  settings:    'key, company_uuid, user_uuid, device_uuid, updated_at',

  // File d'attente des opérations hors ligne
  // (_docs/13, section "FILE D'ATTENTE DES OPÉRATIONS")
  // operation_type: CREATE | UPDATE | DELETE (Soft Delete)
  syncQueue:   '++id, operation_uuid, company_uuid, store_uuid, user_uuid, device_uuid, entity_type, entity_uuid, operation_type, status, created_at, synced_at',

  // Journal de synchronisation
  syncLog:     '++id, company_uuid, store_uuid, user_uuid, device_uuid, entity_type, operation_type, status, message, created_at',

  // Sessions POS en cours / brouillons
  posSessions: 'uuid, company_uuid, store_uuid, user_uuid, device_uuid, status, created_at',

  // Ventes POS (créées hors ligne ou mises en cache)
  sales: 'uuid, company_uuid, store_uuid, user_uuid, device_uuid, status, created_at',

  // Mouvements de stock hors ligne
  // (_docs/13, section "STOCK")
  stockMovements: 'uuid, company_uuid, store_uuid, user_uuid, device_uuid, product_uuid, movement_type, status, created_at',

  // Préférences utilisateur locales
  preferences: 'key, company_uuid, user_uuid, device_uuid',
});

// v5 : entrepôts (_docs/15, étape 1.9)
db.version(DB_VERSION).stores({
  products:    'uuid, company_uuid, store_uuid, user_uuid, device_uuid, name, updated_at',
  categories:  'uuid, company_uuid, store_uuid, user_uuid, device_uuid, name, updated_at',
  customers:   'uuid, company_uuid, user_uuid, device_uuid, name, updated_at',
  suppliers:   'uuid, company_uuid, user_uuid, device_uuid, name, updated_at',
  stores:      'uuid, company_uuid, user_uuid, device_uuid, name, updated_at',
  warehouses:  'uuid, company_uuid, store_uuid, user_uuid, device_uuid, name, updated_at',
  settings:    'key, company_uuid, user_uuid, device_uuid, updated_at',
  syncQueue:   '++id, operation_uuid, company_uuid, store_uuid, warehouse_uuid, user_uuid, device_uuid, entity_type, entity_uuid, operation_type, status, created_at, synced_at',
  syncLog:     '++id, company_uuid, store_uuid, user_uuid, device_uuid, entity_type, operation_type, status, message, created_at',
  posSessions: 'uuid, company_uuid, store_uuid, user_uuid, device_uuid, status, created_at',
  sales:       'uuid, company_uuid, store_uuid, warehouse_uuid, user_uuid, device_uuid, status, created_at',
  stockMovements: 'uuid, company_uuid, store_uuid, warehouse_uuid, user_uuid, device_uuid, product_uuid, movement_type, status, created_at',
  preferences: 'key, company_uuid, user_uuid, device_uuid',
});

// v6 : variantes et lots (_docs/15, étape 4.6) — tables de cache +
// variant_uuid / lot_uuid sur les mouvements et les ventes.
db.version(6).stores({
  variants:    'uuid, company_uuid, product_uuid, user_uuid, device_uuid, updated_at',
  lots:        'uuid, company_uuid, product_uuid, variant_uuid, user_uuid, device_uuid, number, updated_at',
  sales:       'uuid, company_uuid, store_uuid, warehouse_uuid, user_uuid, device_uuid, status, created_at',
  stockMovements: 'uuid, company_uuid, store_uuid, warehouse_uuid, user_uuid, device_uuid, product_uuid, variant_uuid, lot_uuid, movement_type, status, created_at',
});

export default db;

/**
 * Correspondance entity_type (syncQueue) → table IndexedDB de cache.
 * Partagée par useOfflineMutation et syncManager.
 */
export const ENTITY_TO_TABLE = {
  product: 'products',
  category: 'categories',
  customer: 'customers',
  supplier: 'suppliers',
  warehouse: 'warehouses',
  variant: 'variants',
  lot: 'lots',
  sale: 'sales',
  posSession: 'posSessions',
  stockMovement: 'stockMovements',
  stockTransfer: 'stockMovements',
  inventory: 'stockMovements',
};

/**
 * Nettoie les données de cache d'une entreprise donnée.
 * Préserve syncQueue et posSessions (ventes/brouillons non synchronisés).
 * À appeler lors d'un changement de compte ou de société.
 */
export async function clearCompanyData(companyUuid) {
  if (!companyUuid) return;
  const cacheTables = ['products', 'categories', 'customers', 'suppliers',
                       'stores', 'warehouses', 'variants', 'lots',
                       'settings', 'syncLog', 'preferences', 'stockMovements', 'sales'];
  for (const table of cacheTables) {
    await db.table(table).where('company_uuid').equals(companyUuid).delete();
  }
}

/**
 * Nettoie les caches au logout — préserve les ventes en attente.
 *
 * Efface : products, categories, customers, suppliers, stores, settings,
 *          syncLog, preferences, stockMovements
 * Préserve : syncQueue (ventes non synchronisées), posSessions (brouillons)
 *
 * (_docs/11_MODULE_PWA.txt : "Une synchronisation échouée ne doit jamais
 *  entraîner une perte de données.")
 */
export async function clearCacheData() {
  const cacheTables = ['products', 'categories', 'customers', 'suppliers',
                       'stores', 'warehouses', 'variants', 'lots',
                       'settings', 'syncLog', 'preferences', 'stockMovements', 'sales'];
  await Promise.all(
    cacheTables.map((table) => db.table(table).clear())
  );
}

/**
 * Nettoie TOUT, y compris syncQueue et posSessions.
 * À appeler uniquement après une synchronisation réussie (plus rien en attente).
 */
export async function clearAllData() {
  await Promise.all(
    db.tables.map((table) => table.clear())
  );
}

/**
 * Vérifie s'il reste des opérations non synchronisées.
 * États non synchronisés : PENDING_SYNC, SYNCING, FAILED, conflict
 */
export async function hasPendingSync() {
  const count = await db.syncQueue
    .where('status').anyOf(['PENDING_SYNC', 'SYNCING', 'FAILED', 'conflict', 'pending', 'error'])
    .count();
  return count > 0;
}

/**
 * Compte les ventes non synchronisées pour un utilisateur donné.
 *
 * (_docs/11_MODULE_PWA.txt, section "BLOCAGE DE CHANGEMENT D'UTILISATEUR")
 */
export async function getPendingCountForUser(userUuid) {
  if (!userUuid) return 0;
  return db.syncQueue
    .where('user_uuid').equals(userUuid)
    .and((op) => ['PENDING_SYNC', 'SYNCING', 'FAILED', 'conflict', 'pending', 'error'].includes(op.status))
    .count();
}

/**
 * Récupère toutes les opérations en attente (tous utilisateurs confondus).
 */
export async function getAllPendingOps() {
  return db.syncQueue
    .where('status').anyOf(['PENDING_SYNC', 'SYNCING', 'FAILED', 'conflict', 'pending', 'error'])
    .toArray();
}
