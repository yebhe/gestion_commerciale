import { useEffect, useState } from 'react';
import { X, Package, Layers, Tag } from 'lucide-react';
import { mediaUrl } from '../../../lib/api';
import { loadVariantsWithCache, loadLotsWithCache } from '../../../pwa/preloadCache';

const attrsToText = (attrs) =>
  Object.entries(attrs || {}).map(([k, v]) => `${k}: ${v}`).join(' / ');

/**
 * Fiche produit en lecture seule : infos + variantes + lots (étape 4.5).
 * Fonctionne hors ligne via le cache IndexedDB.
 */
export default function ProductDetailModal({ product, onClose }) {
  const [variants, setVariants] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!product?.uuid) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      loadVariantsWithCache(product.uuid).catch(() => []),
      loadLotsWithCache(product.uuid).catch(() => []),
    ]).then(([v, l]) => {
      if (!cancelled) {
        setVariants(v || []);
        setLots(l || []);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [product?.uuid]);

  if (!product) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-primary-50 flex items-center justify-center overflow-hidden flex-shrink-0">
              {product.image ? (
                <img src={mediaUrl(product.image)} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <Package size={26} className="text-primary-600" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">{product.name}</h3>
              <p className="text-muted text-sm">
                {Number(product.selling_price).toLocaleString('fr-FR')} FCFA
                {product.barcode ? ` — ${product.barcode}` : ''}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="p-2 rounded-lg text-muted hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {product.description && (
          <p className="text-sm text-muted mb-4">{product.description}</p>
        )}

        {loading ? (
          <p className="text-muted text-sm">Chargement…</p>
        ) : (
          <>
            <div className="mb-4">
              <h4 className="flex items-center gap-2 font-semibold text-foreground mb-2">
                <Layers size={18} className="text-primary-600" />
                Variantes ({variants.length})
              </h4>
              {variants.length === 0 ? (
                <p className="text-muted text-sm">Aucune variante.</p>
              ) : (
                <ul className="space-y-2">
                  {variants.map((v) => (
                    <li key={v.uuid}
                      className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 text-sm">
                      <span className="font-medium text-foreground">
                        {attrsToText(v.attributes) || v.sku || 'Variante'}
                        {!v.is_active && <span className="ml-2 text-xs text-red-500">(inactive)</span>}
                      </span>
                      <span className="text-muted">
                        {v.sku && <span className="mr-2">{v.sku}</span>}
                        {v.selling_price != null
                          ? `${Number(v.selling_price).toLocaleString('fr-FR')} FCFA`
                          : 'prix du produit'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-semibold text-foreground mb-2">
                <Tag size={18} className="text-primary-600" />
                Lots ({lots.length})
              </h4>
              {lots.length === 0 ? (
                <p className="text-muted text-sm">Aucun lot.</p>
              ) : (
                <ul className="space-y-2">
                  {lots.map((l) => (
                    <li key={l.uuid}
                      className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 text-sm">
                      <span className="font-medium text-foreground">Lot {l.number}</span>
                      <span className="text-muted">
                        {l.expiry_date && <span className="mr-2">expire le {l.expiry_date}</span>}
                        {l.variant && (attrsToText(l.variant.attributes) || l.variant.sku)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
