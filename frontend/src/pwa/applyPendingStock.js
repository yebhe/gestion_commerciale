import db from './db';

/**
 * Ajuste le stock affiché des produits en incluant les mouvements
 * de stock et les ventes en attente de synchronisation.
 */
const OUT_TYPES = new Set(['out', 'sale_out', 'transfer_out', 'loss', 'breakage']);
const IN_TYPES = new Set(['in', 'purchase_in', 'sale_cancel_in', 'transfer_in', 'return_in', 'initial']);

export async function applyPendingStock(products, targetStoreUuid, targetWarehouseUuid = null) {
  let pending = await db.syncQueue
    .where('entity_type')
    .anyOf(['stockMovement', 'stockTransfer', 'inventory', 'sale'])
    .toArray();
  pending = pending.filter((op) => op.status !== 'SYNCED');
  if (!pending.length) return products;

  // Un CREATE suivi d'un DELETE pour le même UUID s'annulent.
  const deletedByUuid = new Map();
  const createdByUuid = new Map();
  for (const op of pending) {
    if (op.operation_type === 'DELETE' && op.entity_uuid) deletedByUuid.set(op.entity_uuid, op);
    if (op.operation_type === 'CREATE' && op.entity_uuid) createdByUuid.set(op.entity_uuid, op);
  }
  const cancelled = new Set();
  for (const uuid of deletedByUuid.keys()) {
    if (createdByUuid.has(uuid)) {
      cancelled.add(uuid);
    }
  }
  const relevant = pending.filter((op) => {
    if (op.operation_type === 'CREATE' && cancelled.has(op.entity_uuid)) return false;
    if (op.operation_type === 'DELETE' && cancelled.has(op.entity_uuid)) return false;
    return true;
  });
  if (!relevant.length) return products;

  const stockDeletedIds = [];
  const saleDeletedIds = [];
  for (const op of relevant) {
    if (op.operation_type !== 'DELETE' || !op.entity_uuid) continue;
    if (op.entity_type === 'sale') saleDeletedIds.push(op.entity_uuid);
    else stockDeletedIds.push(op.entity_uuid);
  }
  const [stockDeletedRows, saleDeletedRows] = await Promise.all([
    stockDeletedIds.length ? db.stockMovements.where('uuid').anyOf(stockDeletedIds).toArray() : Promise.resolve([]),
    saleDeletedIds.length ? db.sales.where('uuid').anyOf(saleDeletedIds).toArray() : Promise.resolve([]),
  ]);
  const rowByUuid = {
    ...Object.fromEntries(stockDeletedRows.map((m) => [m.uuid, m])),
    ...Object.fromEntries(saleDeletedRows.map((m) => [m.uuid, m])),
  };

  return products.map((p) => {
    const productUuid = p.uuid;
    let delta = 0;
    let adjusted = false;
    let newQty = null;

    const matchesStore = (store) => !targetStoreUuid || store === targetStoreUuid;
    const matchesWarehouse = (wh) => !targetWarehouseUuid || !wh || wh === targetWarehouseUuid;

    for (const op of relevant) {
      if (op.operation_type === 'DELETE') {
        const m = rowByUuid[op.entity_uuid];
        if (!m) continue;
        if (op.entity_type === 'sale') {
          if (!matchesStore(m.store)) continue;
          for (const item of m.items || []) {
            if (item.product === productUuid) delta += (item.quantity || 0);
          }
          continue;
        }
        if ((m.product !== productUuid && m.product_uuid !== productUuid)) continue;
        const mType = m.type || m.movement_type;
        const mWh = m.warehouse_uuid || m.warehouse;
        if ((IN_TYPES.has(mType) || OUT_TYPES.has(mType)) && matchesStore(m.store) && matchesWarehouse(mWh)) {
          delta += (OUT_TYPES.has(mType) ? 1 : -1) * (m.quantity || 0);
        } else if (m.from_store && m.to_store) {
          if (matchesStore(m.from_store)) delta += (m.quantity || 0);
          if (matchesStore(m.to_store)) delta -= (m.quantity || 0);
        }
        continue;
      }

      const payload = op.payload || {};
      if (op.entity_type === 'sale') {
        if (!matchesStore(payload.store)) continue;
        for (const item of payload.items || []) {
          if (item.product === productUuid) delta -= (item.quantity || 0);
        }
        continue;
      }

      // Transfert immédiat en attente (3.10) : items[] + from/to store.
      if (op.entity_type === 'stockTransfer' || (payload.from_store && payload.to_store && payload.items)) {
        for (const item of payload.items || []) {
          if (item.product !== productUuid) continue;
          const qty = item.quantity_requested || item.quantity || 0;
          if (matchesStore(payload.from_store)) delta -= qty;
          if (matchesStore(payload.to_store)) delta += qty;
        }
        continue;
      }

      if (payload.product !== productUuid) continue;
      const type = payload.type || payload.movement_type;
      const pWh = payload.warehouse || op.warehouse_uuid;
      if (IN_TYPES.has(type) && matchesStore(payload.store) && matchesWarehouse(pWh)) {
        delta += (payload.quantity || 0);
      } else if (OUT_TYPES.has(type) && matchesStore(payload.store) && matchesWarehouse(pWh)) {
        delta -= (payload.quantity || 0);
      } else if (type === 'adjustment' && matchesStore(payload.store) && matchesWarehouse(pWh)) {
        adjusted = true;
        newQty = payload.new_quantity ?? payload.quantity;
      } else if (payload.from_store && payload.to_store) {
        if (matchesStore(payload.from_store)) delta -= (payload.quantity || 0);
        if (matchesStore(payload.to_store)) delta += (payload.quantity || 0);
      }
    }

    const base = targetWarehouseUuid
      ? (p.stock_by_warehouse?.find((s) => s.warehouse?.uuid === targetWarehouseUuid)?.quantity ?? 0)
      : !targetStoreUuid
        ? (p.stock_quantity || 0)
        : (p.stock_by_store?.find((s) => s.store?.uuid === targetStoreUuid)?.quantity ?? 0);
    const final = adjusted ? newQty : base + delta;

    const product = { ...p };
    if (targetWarehouseUuid) {
      const sbw = [...(p.stock_by_warehouse || [])];
      const idx = sbw.findIndex((s) => s.warehouse?.uuid === targetWarehouseUuid);
      if (idx >= 0) {
        sbw[idx] = { ...sbw[idx], quantity: final };
      } else {
        sbw.push({ warehouse: { uuid: targetWarehouseUuid }, quantity: final });
      }
      product.stock_by_warehouse = sbw;
    } else if (!targetStoreUuid) {
      product.stock_quantity = final;
    } else {
      const sbs = [...(p.stock_by_store || [])];
      const idx = sbs.findIndex((s) => s.store?.uuid === targetStoreUuid);
      if (idx >= 0) {
        sbs[idx] = { ...sbs[idx], quantity: final };
      } else {
        sbs.push({ store: { uuid: targetStoreUuid }, quantity: final });
      }
      product.stock_by_store = sbs;
    }
    return product;
  });
}
