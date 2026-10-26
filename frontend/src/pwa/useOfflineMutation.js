/**
 * Hook React pour les mutations hors ligne (CREATE / UPDATE / DELETE).
 *
 * (_docs/13_FONCTIONNALITE_HORS_LIGNE.txt)
 *
 * Comportement :
 * - Si en ligne : exécute l'appel API directement + met à jour le cache local.
 * - Si hors ligne : enregistre l'opération dans syncQueue (IndexedDB) +
 *   met à jour le cache local pour que l'UI reflète le changement.
 * - Au retour de la connexion, syncManager synchronise automatiquement.
 *
 * Usage :
 *   const { mutate, loading, error } = useOfflineMutation('product', 'CREATE');
 *   await mutate({ name: 'Coca', price: 500 }, { company_uuid, store_uuid, user_uuid });
 */

import { useState, useCallback } from 'react';
import { usePWA } from './PWAContext';
import { useAuth } from '../contexts/AuthContext';
import syncManager from './syncManager';
import db, { ENTITY_TO_TABLE } from './db';
import { isModuleOffline, isOperationOffline } from './offlineModules';

/**
 * Mappe les clés de modules vers les entity_type du syncManager.
 */
const OFFLINE_ENTITY_MAP = {
  products: 'product',
  categories: 'category',
  customers: 'customer',
  suppliers: 'supplier',
  stock: 'stockMovement',
  pos: 'sale',
};

export function useOfflineMutation(moduleKey, operationType) {
  const { online } = usePWA();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const entity_type = isModuleOffline(moduleKey)
    ? OFFLINE_ENTITY_MAP[moduleKey] || moduleKey
    : moduleKey;

  const mutate = useCallback(async (payload, context = {}) => {
    setLoading(true);
    setError(null);

    // Pour les CREATE, générer un UUID côté client afin que l'objet apparaisse
    // immédiatement dans le cache IndexedDB en mode hors ligne.
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    const existingUuid = isFormData ? payload.get('uuid') : payload?.uuid;
    const needsUuid = operationType === 'CREATE' && !context?.entity_uuid && !existingUuid;
    let finalPayload = payload;
    let generatedUuid = null;
    if (needsUuid) {
      generatedUuid = crypto.randomUUID();
      if (isFormData) {
        payload.append('uuid', generatedUuid);
      } else {
        finalPayload = { ...payload, uuid: generatedUuid };
      }
    }
    const finalEntityUuid = context?.entity_uuid || existingUuid || generatedUuid || null;

    const opContext = {
      company_uuid: context.company_uuid || localStorage.getItem('current_company_uuid'),
      store_uuid: context.store_uuid || null,
      warehouse_uuid: context.warehouse_uuid || finalPayload?.warehouse || null,
      user_uuid: context.user_uuid || user?.uuid,
      entity_type: entity_type,
      entity_uuid: finalEntityUuid,
      operation_type: operationType,
      payload: finalPayload,
    };

    const isNetworkError = (err) =>
      !navigator.onLine ||
      !err.response ||
      err.response?.status === 0 ||
      err.code === 'ERR_NETWORK' ||
      (err.name === 'AxiosError' && !err.response);

    try {
      if (online) {
        // En ligne : exécuter directement via le syncManager handler
        const result = await syncManager._processOp(opContext);
        // Mettre à jour le cache local
        await updateLocalCache(entity_type, operationType, opContext, result?.data);
        return result?.data;
      }

      // Hors ligne : mettre en file d'attente
      try {
        await syncManager.enqueue(opContext);
        await updateLocalCache(entity_type, operationType, opContext, finalPayload);
      } catch (queueErr) {
        console.warn('[PWA] File d\'attente hors ligne échouée:', queueErr);
      }
      return finalPayload;
    } catch (err) {
      // Si l'appel API échoue (réseau coupé ou erreur réseau), fallback hors ligne
      if (isNetworkError(err)) {
        try {
          await syncManager.enqueue(opContext);
          await updateLocalCache(entity_type, operationType, opContext, finalPayload);
        } catch (queueErr) {
          console.warn('[PWA] File d\'attente hors ligne échouée:', queueErr);
        }
        return finalPayload;
      }
      setError(err);
      throw err;
    } finally {
      window.dispatchEvent(
        new CustomEvent('yebhe:data-changed', { detail: { entity_type, operation_type: operationType } })
      );
      setLoading(false);
    }
  }, [online, user, entity_type, operationType]);

  return { mutate, loading, error };
}

/**
 * Met à jour le cache IndexedDB local selon l'opération.
 */
async function updateLocalCache(entity_type, operation_type, op, responseData) {
  const tableName = ENTITY_TO_TABLE[entity_type];
  if (!tableName) return;

  const data = responseData || op.payload;
  const company_uuid = op.company_uuid;

  if (operation_type === 'CREATE') {
    if (data && data.uuid) {
      await db.table(tableName).put({
        ...data,
        company_uuid,
        store_uuid: op.store_uuid,
        warehouse_uuid: op.warehouse_uuid || data.warehouse || null,
        user_uuid: op.user_uuid,
        updated_at: new Date().toISOString(),
      });
    }
  } else if (operation_type === 'UPDATE') {
    if (op.entity_uuid) {
      const existing = await db.table(tableName).where('uuid').equals(op.entity_uuid).first();
      if (existing) {
        await db.table(tableName).update(existing.id || existing.uuid, {
          ...data,
          updated_at: new Date().toISOString(),
        });
      } else {
        await db.table(tableName).put({
          ...data,
          uuid: op.entity_uuid,
          company_uuid,
          store_uuid: op.store_uuid,
          user_uuid: op.user_uuid,
          updated_at: new Date().toISOString(),
        });
      }
    }
  } else if (operation_type === 'DELETE') {
    if (op.entity_uuid) {
      // Soft Delete local : marquer comme supprimé
      const existing = await db.table(tableName).where('uuid').equals(op.entity_uuid).first();
      if (existing) {
        await db.table(tableName).update(existing.id || existing.uuid, {
          is_deleted: true,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }
}
