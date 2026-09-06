/**
 * Gestionnaire de synchronisation — file d'attente des opérations hors ligne.
 *
 * (_docs/11_MODULE_PWA.txt, _docs/13_FONCTIONNALITE_HORS_LIGNE.txt)
 *
 * États des opérations :
 *   PENDING_SYNC — en attente de synchronisation
 *   SYNCING      — synchronisation en cours
 *   SYNCED       — synchronisée avec le serveur (supprimée de la file)
 *   FAILED       — échec (reste dans la file pour nouvelle tentative)
 *   conflict     — conflit détecté (409), l'utilisateur doit résoudre
 *
 * Types d'opérations (_docs/13, section "TYPES D'OPÉRATIONS") :
 *   CREATE — création d'une entité
 *   UPDATE — modification d'une entité
 *   DELETE — suppression (Soft Delete)
 *
 * Modules hors ligne (_docs/13, section "MODULES AUTORISÉS HORS LIGNE") :
 *   products, categories, customers, suppliers, stock, pos, sales
 *
 * Principes :
 * - Toutes les opérations hors ligne utilisent des UUID (pas de collision).
 * - Chaque opération contient company_uuid, store_uuid, user_uuid, device_uuid.
 * - Les opérations sont traitées dans l'ordre (FIFO).
 * - Une opération réussie est supprimée de la file (statut = SYNCED).
 * - Une opération échouée reste dans la file (statut = FAILED) pour nouvelle tentative.
 * - Aucune donnée ne doit être perdue (_docs/11, section "ÉCHEC").
 * - Toutes les synchronisations sont journalisées (syncLog).
 * - En cas de conflit (409), l'utilisateur est informé.
 * - Les suppressions sont des Soft Deletes (_docs/13, section "POINTS CRITIQUES").
 */

import db, { ENTITY_TO_TABLE } from './db';
import api from '../lib/api';
import { getDeviceUuid } from './sessionManager';

/**
 * Handlers de synchronisation par entité et type d'opération.
 * (_docs/13, section "MODULES AUTORISÉS HORS LIGNE")
 */
const SYNC_ENTITIES = {
  // POS / Ventes
  sale: {
    CREATE: (payload, entity_uuid) => api.post('/sales/', payload),
  },
  posSession: {
    CREATE: (payload) => api.post('/sales/sessions/', payload),
    UPDATE: (entity_uuid, payload) => api.patch(`/sales/sessions/${entity_uuid}/`, payload),
  },

  // Produits — CRUD complet hors ligne
  product: {
    CREATE: (payload) => {
      // Les produits peuvent avoir des images (FormData)
      if (payload instanceof FormData) {
        return api.post('/products/', payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      return api.post('/products/', payload);
    },
    UPDATE: (entity_uuid, payload) => {
      if (payload instanceof FormData) {
        return api.patch(`/products/${entity_uuid}/`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      return api.patch(`/products/${entity_uuid}/`, payload);
    },
    DELETE: (entity_uuid) => api.delete(`/products/${entity_uuid}/`), // Soft Delete côté serveur
  },

  // Catégories — CRUD complet hors ligne (même endpoints que categoriesAPI)
  category: {
    CREATE: (payload) => api.post('/products/categories/', payload),
    UPDATE: (entity_uuid, payload) => api.patch(`/products/categories/${entity_uuid}/`, payload),
    DELETE: (entity_uuid) => api.delete(`/products/categories/${entity_uuid}/`),
  },

  // Clients — CRUD complet hors ligne
  customer: {
    CREATE: (payload) => api.post('/customers/', payload),
    UPDATE: (entity_uuid, payload) => api.patch(`/customers/${entity_uuid}/`, payload),
    DELETE: (entity_uuid) => api.delete(`/customers/${entity_uuid}/`),
  },

  // Fournisseurs — CRUD complet hors ligne
  supplier: {
    CREATE: (payload) => api.post('/suppliers/', payload),
    UPDATE: (entity_uuid, payload) => api.patch(`/suppliers/${entity_uuid}/`, payload),
    DELETE: (entity_uuid) => api.delete(`/suppliers/${entity_uuid}/`),
  },

  // Stock — mouvements hors ligne
  // (_docs/13, section "STOCK")
  stockMovement: {
    CREATE: (payload) => api.post('/inventory/', payload),
    DELETE: (entity_uuid) => api.delete(`/inventory/${entity_uuid}/`),
  },
  inventory: {
    CREATE: (payload) => api.post('/inventory/', payload),
  },
  stockTransfer: {
    CREATE: (payload) => api.post('/inventory/transfer/', payload),
  },
};

class SyncManager extends EventTarget {
  constructor() {
    super();
    this._syncing = false;
  }

  /**
   * Ajoute une opération à la file d'attente.
   *
   * (_docs/13, section "FILE D'ATTENTE DES OPÉRATIONS")
   *
   * @param {object} op - {
   *   company_uuid, store_uuid, user_uuid,
   *   entity_type, entity_uuid, operation_type, payload
   * }
   * Le device_uuid et operation_uuid sont ajoutés automatiquement.
   */
  async enqueue(op) {
    const operation_uuid = crypto.randomUUID();
    const id = await db.syncQueue.add({
      operation_uuid,
      company_uuid: op.company_uuid,
      store_uuid: op.store_uuid || null,
      user_uuid: op.user_uuid,
      device_uuid: op.device_uuid || getDeviceUuid(),
      entity_type: op.entity_type,
      entity_uuid: op.entity_uuid || null,
      operation_type: op.operation_type, // CREATE | UPDATE | DELETE
      payload: op.payload || null,
      status: 'PENDING_SYNC',
      retry_count: 0,
      created_at: new Date().toISOString(),
      synced_at: null,
    });
    this.dispatchEvent(new CustomEvent('enqueued', { detail: op }));
    return id;
  }

  /**
   * Tente de synchroniser toutes les opérations en attente.
   * Retourne { synced, failed, conflicts }.
   */
  async syncAll() {
    if (this._syncing) return { synced: 0, failed: 0, conflicts: [] };
    this._syncing = true;
    this.dispatchEvent(new CustomEvent('syncStart'));

    const result = { synced: 0, failed: 0, conflicts: [] };
    let pending = await db.syncQueue
      .where('status').anyOf(['PENDING_SYNC', 'FAILED', 'pending', 'error'])
      .sortBy('id');

    // Annuler les paires CREATE + DELETE pour le même UUID (jamais syncées).
    const createdByUuid = new Map();
    const deletedByUuid = new Map();
    for (const op of pending) {
      if (op.operation_type === 'CREATE' && op.entity_uuid) createdByUuid.set(op.entity_uuid, op);
      if (op.operation_type === 'DELETE' && op.entity_uuid) deletedByUuid.set(op.entity_uuid, op);
    }
    const cancelled = new Set();
    for (const uuid of deletedByUuid.keys()) {
      if (createdByUuid.has(uuid)) cancelled.add(uuid);
    }
    for (const op of pending) {
      if ((op.operation_type === 'CREATE' || op.operation_type === 'DELETE') && cancelled.has(op.entity_uuid)) {
        await db.syncQueue.delete(op.id);
      }
    }
    pending = pending.filter((op) => {
      if ((op.operation_type === 'CREATE' || op.operation_type === 'DELETE') && cancelled.has(op.entity_uuid)) return false;
      return true;
    });

    for (const op of pending) {
      // Marquer comme SYNCING
      await db.syncQueue.update(op.id, { status: 'SYNCING' });
      try {
        const response = await this._processOp(op);
        await this._reconcileCache(op, response?.data);
        // Succès : marquer SYNCED puis supprimer de la file
        await db.syncQueue.update(op.id, {
          status: 'SYNCED',
          synced_at: new Date().toISOString(),
        });
        await db.syncQueue.delete(op.id);
        result.synced++;
        await this._log(op, 'SYNCED', 'Opération synchronisée avec le serveur.');
      } catch (err) {
        const status = err.response?.status;
        if (status === 409) {
          await db.syncQueue.update(op.id, { status: 'conflict' });
          result.conflicts.push({ op, error: err.response?.data });
          await this._log(op, 'conflict', JSON.stringify(err.response?.data || err.message));
        } else {
          await db.syncQueue.update(op.id, {
            status: 'FAILED',
            retry_count: (op.retry_count || 0) + 1,
            last_error: err.message,
          });
          result.failed++;
          await this._log(op, 'FAILED', err.message);
        }
      }
    }

    this._syncing = false;
    this.dispatchEvent(new CustomEvent('syncEnd', { detail: result }));
    return result;
  }

  async _processOp(op) {
    const handler = SYNC_ENTITIES[op.entity_type]?.[op.operation_type];
    if (!handler) throw new Error(`Opération non supportée: ${op.entity_type}.${op.operation_type}`);
    if (op.operation_type === 'CREATE') {
      return await handler(op.payload);
    }
    return await handler(op.entity_uuid, op.payload);
  }

  /**
   * Aligne le cache IndexedDB sur la réponse serveur après synchronisation.
   * Le serveur ignore l'UUID généré côté client (champ read-only) : pour un
   * CREATE, l'enregistrement local (UUID client) est remplacé par la version
   * serveur (UUID serveur). Les échecs de cache ne bloquent pas la synchro.
   */
  async _reconcileCache(op, serverData) {
    const tableName = ENTITY_TO_TABLE[op.entity_type];
    if (!tableName) return;
    const table = db.table(tableName);
    try {
      if (op.operation_type === 'DELETE') {
        if (op.entity_uuid) await table.where('uuid').equals(op.entity_uuid).delete();
        return;
      }
      if (!serverData || !serverData.uuid) return;
      const meta = {
        company_uuid: op.company_uuid,
        store_uuid: op.store_uuid || null,
        user_uuid: op.user_uuid || null,
        device_uuid: op.device_uuid || null,
        updated_at: new Date().toISOString(),
      };
      if (op.operation_type === 'CREATE' && op.entity_uuid && op.entity_uuid !== serverData.uuid) {
        await table.where('uuid').equals(op.entity_uuid).delete();
      }
      await table.put({ ...serverData, ...meta });
    } catch (err) {
      await this._log(op, 'FAILED', `Cache local non réconcilié : ${err.message}`);
    }
  }

  async _log(op, status, message) {
    await db.syncLog.add({
      company_uuid: op.company_uuid,
      store_uuid: op.store_uuid || null,
      user_uuid: op.user_uuid || null,
      device_uuid: op.device_uuid || getDeviceUuid(),
      entity_type: op.entity_type,
      operation_type: op.operation_type,
      status,
      message,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Retente une opération spécifique (après résolution de conflit).
   */
  async retry(opId) {
    const op = await db.syncQueue.get(opId);
    if (!op) return;
    await db.syncQueue.update(opId, { status: 'PENDING_SYNC' });
    return this.syncAll();
  }

  /**
   * Supprime une opération de la file (après résolution manuelle).
   */
  async remove(opId) {
    await db.syncQueue.delete(opId);
    this.dispatchEvent(new CustomEvent('removed', { detail: { id: opId } }));
  }

  /**
   * Récupère les opérations en attente pour une entreprise.
   */
  async getPending(companyUuid) {
    return db.syncQueue
      .where('company_uuid').equals(companyUuid)
      .and((op) => ['PENDING_SYNC', 'SYNCING', 'FAILED', 'conflict', 'pending', 'error'].includes(op.status))
      .toArray();
  }

  /**
   * Récupère le journal de synchronisation.
   */
  async getLog(companyUuid, limit = 50) {
    return db.syncLog
      .where('company_uuid').equals(companyUuid)
      .reverse()
      .limit(limit)
      .toArray();
  }

  get isSyncing() {
    return this._syncing;
  }
}

const syncManager = new SyncManager();
export default syncManager;
