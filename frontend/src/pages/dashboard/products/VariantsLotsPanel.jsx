import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, Layers, Tag } from 'lucide-react';
import { variantsAPI, lotsAPI } from '../../../lib/api';
import { usePWA } from '../../../pwa/PWAContext';
import { inputClass, labelClass, btnPrimary, btnIcon } from './constants';

const EMPTY_VARIANT = { sku: '', barcode: '', attributes: '', selling_price: '' };
const EMPTY_LOT = { number: '', expiry_date: '', variant: '', supplier: '' };

/**
 * Onglets Variantes / Lots d'un produit existant (_docs/15, étape 4.5).
 * Nécessite le réseau : les routes sont imbriquées /products/{uuid}/...
 */
export default function VariantsLotsPanel({ productUuid, suppliers = [] }) {
  const { online } = usePWA();
  const [tab, setTab] = useState('variants');
  const [variants, setVariants] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [variantForm, setVariantForm] = useState(EMPTY_VARIANT);
  const [lotForm, setLotForm] = useState(EMPTY_LOT);
  const [editingVariant, setEditingVariant] = useState(null);
  const [editingLot, setEditingLot] = useState(null);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [showLotForm, setShowLotForm] = useState(false);

  const load = useCallback(async () => {
    if (!productUuid || !online) { setLoading(false); return; }
    setLoading(true);
    try {
      const [v, l] = await Promise.all([
        variantsAPI.list(productUuid),
        lotsAPI.list(productUuid),
      ]);
      setVariants(v.data.results || v.data || []);
      setLots(l.data.results || l.data || []);
    } catch {
      setError('Impossible de charger les variantes/lots.');
    } finally {
      setLoading(false);
    }
  }, [productUuid, online]);

  useEffect(() => { load(); }, [load]);

  const attrsToText = (attrs) =>
    Object.entries(attrs || {}).map(([k, v]) => `${k}: ${v}`).join(', ');

  const textToAttrs = (text) => {
    const out = {};
    for (const pair of (text || '').split(',')) {
      const idx = pair.indexOf(':');
      if (idx > 0) {
        const k = pair.slice(0, idx).trim();
        const v = pair.slice(idx + 1).trim();
        if (k && v) out[k] = v;
      }
    }
    return out;
  };

  const submitVariant = async () => {
    setError('');
    try {
      const payload = {
        sku: variantForm.sku || null,
        barcode: variantForm.barcode || null,
        attributes: textToAttrs(variantForm.attributes),
        selling_price: variantForm.selling_price === '' ? null : variantForm.selling_price,
      };
      if (editingVariant) {
        await variantsAPI.update(productUuid, editingVariant.uuid, payload);
      } else {
        await variantsAPI.create(productUuid, payload);
      }
      setVariantForm(EMPTY_VARIANT); setEditingVariant(null); setShowVariantForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data
        ? Object.values(err.response.data).flat().join(' ')
        : 'Erreur lors de l\'enregistrement de la variante.');
    }
  };

  const submitLot = async () => {
    setError('');
    if (!lotForm.number.trim()) { setError('Le numéro de lot est requis.'); return; }
    try {
      const payload = {
        number: lotForm.number.trim(),
        expiry_date: lotForm.expiry_date || null,
        variant: lotForm.variant || null,
        supplier: lotForm.supplier || null,
      };
      if (editingLot) {
        await lotsAPI.update(productUuid, editingLot.uuid, payload);
      } else {
        await lotsAPI.create(productUuid, payload);
      }
      setLotForm(EMPTY_LOT); setEditingLot(null); setShowLotForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data
        ? Object.values(err.response.data).flat().join(' ')
        : 'Erreur lors de l\'enregistrement du lot.');
    }
  };

  const removeVariant = async (v) => {
    try { await variantsAPI.remove(productUuid, v.uuid); await load(); }
    catch { setError('Impossible de supprimer cette variante.'); }
  };

  const removeLot = async (l) => {
    try { await lotsAPI.remove(productUuid, l.uuid); await load(); }
    catch { setError('Impossible de supprimer ce lot.'); }
  };

  if (!online) {
    return (
      <p className="text-muted text-sm mt-4">
        La gestion des variantes et lots nécessite une connexion.
      </p>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={() => setTab('variants')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${tab === 'variants' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-muted'}`}>
          <Layers size={16} /> Variantes ({variants.length})
        </button>
        <button type="button" onClick={() => setTab('lots')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${tab === 'lots' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-muted'}`}>
          <Tag size={16} /> Lots ({lots.length})
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Chargement…</p>
      ) : tab === 'variants' ? (
        <div className="space-y-3">
          {variants.map((v) => (
            <div key={v.uuid} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <div className="text-sm">
                <span className="font-medium text-foreground">{attrsToText(v.attributes) || v.sku || 'Variante'}</span>
                {v.sku && <span className="text-muted ml-2">SKU: {v.sku}</span>}
                {v.selling_price != null && (
                  <span className="text-muted ml-2">{Number(v.selling_price).toLocaleString('fr-FR')} FCFA</span>
                )}
                {!v.is_active && <span className="ml-2 text-xs text-red-500">(inactive)</span>}
              </div>
              <div className="flex gap-1">
                <button type="button" className={btnIcon} title="Modifier"
                  onClick={() => {
                    setEditingVariant(v);
                    setVariantForm({
                      sku: v.sku || '', barcode: v.barcode || '',
                      attributes: attrsToText(v.attributes),
                      selling_price: v.selling_price ?? '',
                    });
                    setShowVariantForm(true);
                  }}>
                  <Pencil size={16} />
                </button>
                <button type="button" className="p-2 rounded-lg text-red-600 hover:bg-red-50" title="Supprimer"
                  onClick={() => removeVariant(v)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {variants.length === 0 && !showVariantForm && (
            <p className="text-muted text-sm">Aucune variante.</p>
          )}

          {showVariantForm ? (
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>SKU</label>
                  <input className={inputClass} value={variantForm.sku}
                    onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
                    placeholder="Ex: TSH-NOIR-M" />
                </div>
                <div>
                  <label className={labelClass}>Code-barres</label>
                  <input className={inputClass} value={variantForm.barcode}
                    onChange={(e) => setVariantForm({ ...variantForm, barcode: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Attributs (clé: valeur, séparés par des virgules)</label>
                  <input className={inputClass} value={variantForm.attributes}
                    onChange={(e) => setVariantForm({ ...variantForm, attributes: e.target.value })}
                    placeholder="couleur: Noir, taille: M" />
                </div>
                <div>
                  <label className={labelClass}>Prix de vente (vide = prix du produit)</label>
                  <input className={inputClass} type="number" step="0.01" min="0"
                    value={variantForm.selling_price}
                    onChange={(e) => setVariantForm({ ...variantForm, selling_price: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={submitVariant} className={btnPrimary}>
                  <Check size={18} /> {editingVariant ? 'Modifier' : 'Ajouter'}
                </button>
                <button type="button" onClick={() => { setShowVariantForm(false); setEditingVariant(null); setVariantForm(EMPTY_VARIANT); }}
                  className="flex items-center gap-2 h-12 px-6 rounded-xl border border-border text-foreground text-base font-medium hover:bg-gray-50">
                  <X size={18} /> Annuler
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowVariantForm(true)}
              className="flex items-center gap-2 text-primary-600 text-sm font-medium hover:underline">
              <Plus size={16} /> Ajouter une variante
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {lots.map((l) => (
            <div key={l.uuid} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <div className="text-sm">
                <span className="font-medium text-foreground">Lot {l.number}</span>
                {l.expiry_date && <span className="text-muted ml-2">expire le {l.expiry_date}</span>}
                {l.variant && <span className="text-muted ml-2">· {attrsToText(l.variant.attributes) || l.variant.sku}</span>}
                {l.supplier && <span className="text-muted ml-2">· {l.supplier.name}</span>}
              </div>
              <div className="flex gap-1">
                <button type="button" className={btnIcon} title="Modifier"
                  onClick={() => {
                    setEditingLot(l);
                    setLotForm({
                      number: l.number || '',
                      expiry_date: l.expiry_date || '',
                      variant: l.variant?.uuid || '',
                      supplier: l.supplier?.uuid || '',
                    });
                    setShowLotForm(true);
                  }}>
                  <Pencil size={16} />
                </button>
                <button type="button" className="p-2 rounded-lg text-red-600 hover:bg-red-50" title="Supprimer"
                  onClick={() => removeLot(l)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {lots.length === 0 && !showLotForm && (
            <p className="text-muted text-sm">Aucun lot.</p>
          )}

          {showLotForm ? (
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Numéro de lot *</label>
                  <input className={inputClass} value={lotForm.number}
                    onChange={(e) => setLotForm({ ...lotForm, number: e.target.value })}
                    placeholder="Ex: LOT-2026-001" />
                </div>
                <div>
                  <label className={labelClass}>Date d'expiration</label>
                  <input className={inputClass} type="date" value={lotForm.expiry_date}
                    onChange={(e) => setLotForm({ ...lotForm, expiry_date: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Variante</label>
                  <select className={inputClass} value={lotForm.variant}
                    onChange={(e) => setLotForm({ ...lotForm, variant: e.target.value })}>
                    <option value="">— Aucune —</option>
                    {variants.map((v) => (
                      <option key={v.uuid} value={v.uuid}>
                        {attrsToText(v.attributes) || v.sku || v.uuid}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Fournisseur</label>
                  <select className={inputClass} value={lotForm.supplier}
                    onChange={(e) => setLotForm({ ...lotForm, supplier: e.target.value })}>
                    <option value="">— Aucun —</option>
                    {suppliers.map((s) => (
                      <option key={s.uuid} value={s.uuid}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={submitLot} className={btnPrimary}>
                  <Check size={18} /> {editingLot ? 'Modifier' : 'Ajouter'}
                </button>
                <button type="button" onClick={() => { setShowLotForm(false); setEditingLot(null); setLotForm(EMPTY_LOT); }}
                  className="flex items-center gap-2 h-12 px-6 rounded-xl border border-border text-foreground text-base font-medium hover:bg-gray-50">
                  <X size={18} /> Annuler
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowLotForm(true)}
              className="flex items-center gap-2 text-primary-600 text-sm font-medium hover:underline">
              <Plus size={16} /> Ajouter un lot
            </button>
          )}
        </div>
      )}
    </div>
  );
}
