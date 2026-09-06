/**
 * Hook utilitaire pour mettre en cache des données API dans IndexedDB
 * et les lire hors ligne.
 *
 * (_docs/11_MODULE_PWA.txt, _docs/13_FONCTIONNALITE_HORS_LIGNE.txt)
 *
 * Supporte tous les modules hors ligne :
 * products, categories, customers, suppliers, stockMovements, stores, settings
 */
import { useEffect, useState, useCallback } from 'react';
import db from './db';
import networkManager from './networkManager';

/**
 * Charge des données depuis l'API en ligne, les met en cache dans IndexedDB,
 * et retombe sur le cache hors ligne.
 *
 * @param {string} storeName - Nom de la table Dexie
 * @param {function} fetchFn - Fonction qui retourne une Promise<array>
 * @param {object} opts - { companyUuid, storeUuid?, enabled?, excludeDeleted? }
 */
export function useOfflineCache(storeName, fetchFn, opts = {}) {
  const { companyUuid, storeUuid, enabled = true, excludeDeleted = true } = opts;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);

    // Hors ligne : lire depuis IndexedDB
    if (!networkManager.getState().online) {
      let items = await db.table(storeName).where('company_uuid').equals(companyUuid).toArray();
      if (storeUuid) {
        items = items.filter((i) => !i.store_uuid || i.store_uuid === storeUuid);
      }
      if (excludeDeleted) {
        items = items.filter((i) => !i.is_deleted);
      }
      setData(items);
      setFromCache(true);
      setLoading(false);
      return;
    }

    // En ligne : fetch + cache
    try {
      const response = await fetchFn();
      const items = response.data?.results || response.data || [];
      setData(items);
      setFromCache(false);

      // Mettre en cache
      if (companyUuid && items.length > 0) {
        const tagged = items.map((item) => ({
          ...item,
          company_uuid: companyUuid,
          store_uuid: storeUuid || item.store_uuid || null,
          updated_at: new Date().toISOString(),
        }));
        await db.table(storeName).bulkPut(tagged);
      }
    } catch (err) {
      // En cas d'erreur réseau, retomber sur le cache
      let items = await db.table(storeName).where('company_uuid').equals(companyUuid).toArray();
      if (storeUuid) {
        items = items.filter((i) => !i.store_uuid || i.store_uuid === storeUuid);
      }
      if (excludeDeleted) {
        items = items.filter((i) => !i.is_deleted);
      }
      setData(items);
      setFromCache(true);
    } finally {
      setLoading(false);
    }
  }, [storeName, companyUuid, storeUuid, enabled, excludeDeleted]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, fromCache, reload: load };
}
