/**
 * Pré-chargement du cache hors ligne.
 *
 * Remplit IndexedDB avec toutes les données métier des modules autorisés
 * hors ligne (_docs/13, section "MODULES AUTORISÉS HORS LIGNE") dès la
 * connexion, sans attendre que l'utilisateur visite chaque page.
 */
import api from '../lib/api';
import db from './db';
import networkManager from './networkManager';

const MAX_PAGES = 50;

async function fetchAll(url, params = {}) {
  const all = [];
  let page = 1;
  while (page <= MAX_PAGES) {
    const res = await api.get(url, { params: { ...params, page } });
    const results = res.data?.results || res.data || [];
    all.push(...(Array.isArray(results) ? results : []));
    if (!res.data?.next) break;
    page++;
  }
  return all;
}

function storeUuidOf(item, fallback) {
  if (fallback) return fallback;
  if (item.store && typeof item.store === 'object') return item.store.uuid || null;
  return item.store || null;
}

/**
 * Liste des magasins : API en ligne (avec mise en cache), IndexedDB sinon.
 */
export async function loadStoresWithCache() {
  const companyUuid = localStorage.getItem('current_company_uuid') || '';
  const fromCache = async () => {
    if (!companyUuid) return [];
    const items = await db.stores.where('company_uuid').equals(companyUuid).toArray();
    return items.filter((s) => !s.is_deleted);
  };

  if (!networkManager.getState().online) return fromCache();

  try {
    const all = await fetchAll('/companies/stores/');
    if (companyUuid && all.length) {
      const now = new Date().toISOString();
      await db.stores.bulkPut(all.map((s) => ({ ...s, company_uuid: companyUuid, updated_at: now })));
    }
    return all;
  } catch {
    return fromCache();
  }
}

let running = null;

/**
 * @param {object} ctx - { companyUuid, storeUuid?, userUuid? }
 * @returns {Promise<{ok: string[], failed: string[]}>}
 */
export function preloadOfflineCache(ctx) {
  if (running) return running;
  running = _preload(ctx).finally(() => { running = null; });
  return running;
}

async function _preload({ companyUuid, storeUuid = null, userUuid = null }) {
  const result = { ok: [], failed: [] };
  if (!companyUuid || !networkManager.getState().online) return result;

  const now = new Date().toISOString();
  const tag = (items, extra = () => ({})) => items.map((item) => ({
    ...item,
    company_uuid: companyUuid,
    store_uuid: storeUuidOf(item, storeUuid),
    user_uuid: userUuid,
    updated_at: now,
    ...extra(item),
  }));

  const storeParams = storeUuid ? { store: storeUuid } : {};

  const tasks = [
    ['products', () => fetchAll('/products/', storeParams), (items) => db.products.bulkPut(tag(items))],
    ['categories', () => fetchAll('/products/categories/', storeParams), (items) => db.categories.bulkPut(tag(items))],
    ['customers', () => fetchAll('/customers/', storeParams), (items) => db.customers.bulkPut(tag(items))],
    ['suppliers', () => fetchAll('/suppliers/', storeParams), (items) => db.suppliers.bulkPut(tag(items))],
    ['stores', () => fetchAll('/companies/stores/'), (items) => db.stores.bulkPut(tag(items))],
    ['stockMovements', () => fetchAll('/inventory/', storeParams), (items) => db.stockMovements.bulkPut(tag(items, (m) => ({
      movement_type: m.type || m.movement_type || null,
      is_transfer: !!m.is_transfer || (!!m.from_store && !!m.to_store),
    })))],
  ];

  await Promise.all(tasks.map(async ([name, fetch, save]) => {
    try {
      const items = await fetch();
      if (items.length) await save(items);
      result.ok.push(name);
    } catch (err) {
      result.failed.push(name);
      console.warn(`[PWA] Pré-chargement ${name} échoué:`, err?.message || err);
    }
  }));

  return result;
}
