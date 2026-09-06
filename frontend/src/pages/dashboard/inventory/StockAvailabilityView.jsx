import { Boxes, Package, AlertTriangle, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import Loader from '../../../contexts/Loader';

function getStock(product, storeUuid) {
  if (!storeUuid) return product.stock_quantity || 0;
  const found = product.stock_by_store?.find((s) => s.store?.uuid === storeUuid);
  return found?.quantity ?? 0;
}

export default function StockAvailabilityView({ products, storeUuid, storeName, loading }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const list = products.filter((p) => {
      if (!search) return true;
      const term = search.toLowerCase();
      return (p.name || '').toLowerCase().includes(term) || (p.barcode || '').includes(term);
    });
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [products, search]);

  const { total, lowStockCount } = useMemo(() => {
    let total = 0;
    let low = 0;
    for (const p of filtered) {
      const qty = getStock(p, storeUuid);
      total += qty;
      if (qty <= (p.low_stock_threshold || 5)) low++;
    }
    return { total, lowStockCount: low };
  }, [filtered, storeUuid]);

  if (loading) return <Loader fullscreen={false} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <Boxes size={24} className="text-blue-600" />
          </div>
          <div>
            <p className="text-muted text-sm">Produits</p>
            <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
          </div>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
            <Package size={24} className="text-green-600" />
          </div>
          <div>
            <p className="text-muted text-sm">Stock total {storeName ? `· ${storeName}` : ''}</p>
            <p className="text-2xl font-bold text-foreground">{total}</p>
          </div>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-600" />
          </div>
          <div>
            <p className="text-muted text-sm">Stock faible</p>
            <p className="text-2xl font-bold text-foreground">{lowStockCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-5">
        <div className="relative mb-4">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit..."
            className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-muted text-lg text-center py-8">Aucun produit à afficher.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted text-sm">
                  <th className="py-3 px-4 font-medium">Produit</th>
                  <th className="py-3 px-4 font-medium">Code-barres</th>
                  <th className="py-3 px-4 font-medium text-right">Prix de vente</th>
                  <th className="py-3 px-4 font-medium text-right">Stock {storeName ? `· ${storeName}` : 'global'}</th>
                  <th className="py-3 px-4 font-medium text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const qty = getStock(p, storeUuid);
                  const low = qty <= (p.low_stock_threshold || 5);
                  return (
                    <tr key={p.uuid} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-foreground font-medium">{p.name}</td>
                      <td className="py-3 px-4 text-muted">{p.barcode || '—'}</td>
                      <td className="py-3 px-4 text-right text-foreground">{Number(p.selling_price || 0).toLocaleString('fr-FR')} FCFA</td>
                      <td className="py-3 px-4 text-right font-bold text-foreground">{qty}</td>
                      <td className="py-3 px-4 text-center">
                        {low ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                            <AlertTriangle size={12} />
                            Faible
                          </span>
                        ) : qty === 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">Rupture</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
