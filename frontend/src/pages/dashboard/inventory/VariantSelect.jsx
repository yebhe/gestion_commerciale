import { useEffect, useState } from 'react';
import { loadVariantsWithCache } from '../../../pwa/preloadCache';
import { inputClass, labelClass } from './constants';

/**
 * Sélecteur de variante pour les formulaires de stock (_docs/15, 4.5) :
 * n'affiche rien si le produit n'a pas de variante active.
 */
export default function VariantSelect({ productUuid, value, onChange }) {
  const [variants, setVariants] = useState([]);

  useEffect(() => {
    setVariants([]);
    if (!productUuid) return;
    let cancelled = false;
    loadVariantsWithCache(productUuid)
      .then((list) => {
        if (!cancelled) {
          setVariants((list || []).filter((v) => v.is_active !== false));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [productUuid]);

  if (!variants.length) return null;

  const label = (v) =>
    Object.entries(v.attributes || {}).map(([k, val]) => `${k}: ${val}`).join(' / ')
    || v.sku || 'Variante';

  return (
    <div>
      <label className={labelClass}>Variante</label>
      <select name="variant" value={value || ''} onChange={onChange} className={inputClass}>
        <option value="">— Produit générique —</option>
        {variants.map((v) => (
          <option key={v.uuid} value={v.uuid}>{label(v)}</option>
        ))}
      </select>
    </div>
  );
}
