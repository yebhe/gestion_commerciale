import { useEffect, useState } from 'react';
import {
  TrendingUp, Receipt, Wallet, Boxes, PackageX, FileDown, Store,
} from 'lucide-react';
import Loader from '../../../contexts/Loader';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../../../contexts/AuthContext';
import { reportsAPI, storesAPI } from '../../../lib/api';
import KpiCard from '../../../components/ui/KpiCard';
import AlertDialog from '../../../components/ui/AlertDialog';
import {
  inputClass, labelClass, btnPrimary, btnSecondary,
  PAYMENT_LABELS, MOVEMENT_LABELS, defaultDateRange, formatFCFA,
} from './constants';

/**
 * Module Rapports : chiffre d'affaires, top produits, valeur du stock,
 * ruptures et export CSV (_docs/01_CAHIER_DES_CHARGES_SAA.txt — "rapports").
 * `sub` détermine l'onglet actif, cohérent avec les autres modules
 * (Ventes, Stock, Produits) pilotés par appsCatalog.js.
 */
const ReportsModule = ({ sub, onBack }) => {
  const { hasPermission, scope, assignedStore } = useAuth();
  const isCompanyScope = scope === 'COMPANY';
  const [tab, setTab] = useState(sub || 'sales-report');

  const [stores, setStores] = useState([]);
  const [selectedStoreUuid, setSelectedStoreUuid] = useState(
    !isCompanyScope && assignedStore ? assignedStore.uuid : ''
  );
  const [range, setRange] = useState(defaultDateRange());
  const [loading, setLoading] = useState(false);
  const [salesReport, setSalesReport] = useState(null);
  const [inventoryReport, setInventoryReport] = useState(null);
  const [exportType, setExportType] = useState('sales');
  const [exporting, setExporting] = useState(false);
  const [alert, setAlert] = useState(null);

  const canSales = hasPermission('reports.sales');
  const canInventory = hasPermission('reports.inventory');
  const canExport = hasPermission('reports.export');

  useEffect(() => { setTab(sub || 'sales-report'); }, [sub]);

  useEffect(() => {
    if (!isCompanyScope) return;
    const loadStores = async () => {
      try {
        const all = [];
        let p = 1;
        while (true) {
          const res = await storesAPI.list(p);
          const results = res.data.results || res.data || [];
          all.push(...results);
          if (!res.data.next) break;
          p++;
          if (p > 50) break;
        }
        setStores(all);
      } catch { /* ignore */ }
    };
    loadStores();
  }, [isCompanyScope]);

  const storeParam = isCompanyScope
    ? selectedStoreUuid
    : (assignedStore?.uuid || '');

  const loadSalesReport = async () => {
    setLoading(true);
    try {
      const res = await reportsAPI.sales({ ...range, ...(storeParam && { store: storeParam }) });
      setSalesReport(res.data);
    } catch {
      setAlert({ type: 'error', title: 'Erreur', message: 'Impossible de charger le rapport des ventes.' });
    } finally { setLoading(false); }
  };

  const loadInventoryReport = async () => {
    setLoading(true);
    try {
      const res = await reportsAPI.inventory({ ...(storeParam && { store: storeParam }) });
      setInventoryReport(res.data);
    } catch {
      setAlert({ type: 'error', title: 'Erreur', message: 'Impossible de charger le rapport de stock.' });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'sales-report' && canSales) loadSalesReport();
    if (tab === 'inventory-report' && canInventory) loadInventoryReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, range.date_from, range.date_to, storeParam]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await reportsAPI.export({
        type: exportType, ...range, ...(storeParam && { store: storeParam }),
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rapport_${exportType}_${range.date_from}_${range.date_to}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setAlert({ type: 'success', title: 'Export réussi', message: 'Le fichier a été téléchargé.' });
    } catch {
      setAlert({ type: 'error', title: 'Erreur', message: "Impossible d'exporter le rapport." });
    } finally { setExporting(false); }
  };

  const StoreSelector = () => (
    isCompanyScope && (
      <div className="bg-primary-50 border border-primary-200 rounded-2xl p-5 mb-6">
        <label className={labelClass}>
          <Store size={16} className="inline mr-1.5 -mt-0.5" />
          Magasin
        </label>
        <select
          value={selectedStoreUuid}
          onChange={(e) => setSelectedStoreUuid(e.target.value)}
          className={inputClass}
        >
          <option value="">— Tous les magasins —</option>
          {stores.map((s) => (
            <option key={s.uuid} value={s.uuid}>{s.name}</option>
          ))}
        </select>
      </div>
    )
  );

  const DateRangePicker = () => (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div>
        <label className={labelClass}>Du</label>
        <input
          type="date" className={inputClass} value={range.date_from}
          onChange={(e) => setRange({ ...range, date_from: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass}>Au</label>
        <input
          type="date" className={inputClass} value={range.date_to}
          onChange={(e) => setRange({ ...range, date_to: e.target.value })}
        />
      </div>
    </div>
  );

  const renderSalesReport = () => (
    <>
      <StoreSelector />
      <DateRangePicker />

      {loading ? (
        <Loader fullscreen={false} />
      ) : salesReport ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <KpiCard label="Chiffre d'affaires" value={formatFCFA(salesReport.revenue)} icon={Wallet} color="green" />
            <KpiCard label="Ventes" value={salesReport.sales_count} icon={Receipt} color="blue" />
            <KpiCard label="Panier moyen" value={formatFCFA(salesReport.average_ticket)} icon={TrendingUp} color="orange" />
          </div>

          {salesReport.revenue_by_day.length > 0 && (
            <div className="bg-surface rounded-2xl border border-border p-5 mb-6">
              <p className="text-base font-semibold text-foreground mb-4">Évolution du chiffre d'affaires</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={salesReport.revenue_by_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} />
                  <YAxis stroke="var(--muted)" fontSize={12} />
                  <Tooltip
                    formatter={(value) => formatFCFA(value)}
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="var(--primary-600)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface rounded-2xl border border-border p-5">
              <p className="text-base font-semibold text-foreground mb-3">Top produits</p>
              {salesReport.top_products.length === 0 ? (
                <p className="text-muted">Aucune vente sur la période.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {salesReport.top_products.map((p) => (
                    <li key={p.product__uuid} className="flex items-center justify-between py-2.5">
                      <span className="text-foreground truncate">{p.product__name}</span>
                      <span className="text-muted text-sm flex-shrink-0 ml-3">
                        {p.quantity} u. — {formatFCFA(p.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-surface rounded-2xl border border-border p-5">
              <p className="text-base font-semibold text-foreground mb-3">Par moyen de paiement</p>
              {salesReport.by_payment_method.length === 0 ? (
                <p className="text-muted">Aucune vente sur la période.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {salesReport.by_payment_method.map((pm) => (
                    <li key={pm.payment_method} className="flex items-center justify-between py-2.5">
                      <span className="text-foreground">{PAYMENT_LABELS[pm.payment_method] || pm.payment_method}</span>
                      <span className="text-muted text-sm">{pm.count} — {formatFCFA(pm.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {salesReport.by_store.length > 0 && (
            <div className="bg-surface rounded-2xl border border-border p-5 mt-6">
              <p className="text-base font-semibold text-foreground mb-3">Par magasin</p>
              <ul className="divide-y divide-border">
                {salesReport.by_store.map((s) => (
                  <li key={s.store__uuid} className="flex items-center justify-between py-2.5">
                    <span className="text-foreground">{s.store__name}</span>
                    <span className="text-muted text-sm">{s.count} — {formatFCFA(s.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}
    </>
  );

  const renderInventoryReport = () => (
    <>
      <StoreSelector />

      {loading ? (
        <Loader fullscreen={false} />
      ) : inventoryReport ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <KpiCard label="Produits" value={inventoryReport.total_products} icon={Boxes} color="blue" />
            <KpiCard label="Unités en stock" value={inventoryReport.total_units} icon={Boxes} color="green" />
            <KpiCard label="Valeur du stock" value={formatFCFA(inventoryReport.stock_value)} icon={Wallet} color="orange" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface rounded-2xl border border-border p-5">
              <p className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                <PackageX size={18} className="text-red-500" />
                Stock faible (≤ {inventoryReport.low_stock_threshold})
              </p>
              {inventoryReport.low_stock.length === 0 ? (
                <p className="text-muted">Aucun produit en stock faible.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {inventoryReport.low_stock.map((item, idx) => (
                    <li key={idx} className="flex items-center justify-between py-2.5">
                      <span className="text-foreground truncate">
                        {item.product__name} <span className="text-muted text-sm">— {item.store__name}</span>
                      </span>
                      <span className="text-red-600 font-semibold flex-shrink-0 ml-3">{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-surface rounded-2xl border border-border p-5">
              <p className="text-base font-semibold text-foreground mb-3">Mouvements (30 derniers jours)</p>
              {inventoryReport.movements_summary.length === 0 ? (
                <p className="text-muted">Aucun mouvement sur la période.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {inventoryReport.movements_summary.map((m) => (
                    <li key={m.type} className="flex items-center justify-between py-2.5">
                      <span className="text-foreground">{MOVEMENT_LABELS[m.type] || m.type}</span>
                      <span className="text-muted text-sm">{m.count} mouvement(s) — {m.quantity} u.</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );

  const renderExport = () => (
    <div className="max-w-xl">
      <StoreSelector />
      <div className="mb-6">
        <label className={labelClass}>Type de rapport</label>
        <select className={inputClass} value={exportType} onChange={(e) => setExportType(e.target.value)}>
          <option value="sales">Ventes</option>
          <option value="inventory">Stock</option>
        </select>
      </div>
      {exportType === 'sales' && <DateRangePicker />}
      <button type="button" onClick={handleExport} disabled={exporting}
        className={btnPrimary}>
        <FileDown size={20} />
        {exporting ? 'Export en cours...' : 'Télécharger le CSV'}
      </button>
    </div>
  );

  const TABS = [
    { key: 'sales-report', label: 'Ventes', available: canSales },
    { key: 'inventory-report', label: 'Stock', available: canInventory },
    { key: 'export', label: 'Exporter', available: canExport },
  ].filter((t) => t.available);

  return (
    <div>
      {onBack && (
        <button type="button" onClick={onBack} className={`${btnSecondary} mb-4`}>
          Retour
        </button>
      )}

      <div className="flex items-center gap-2 mb-6 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-base font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales-report' && canSales && renderSalesReport()}
      {tab === 'inventory-report' && canInventory && renderInventoryReport()}
      {tab === 'export' && canExport && renderExport()}

      <AlertDialog alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
};

export default ReportsModule;
