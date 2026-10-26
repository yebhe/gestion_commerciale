import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeftRight, Check, X, PackageCheck, Truck, PackageOpen,
  Ban, Send, Search, Trash2,
} from 'lucide-react';
import { transfersAPI } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { usePWA } from '../../../pwa/PWAContext';
import Loader from '../../../contexts/Loader';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import AlertDialog from '../../../components/ui/AlertDialog';
import { inputClass, btnIcon } from './constants';

const STATUS_META = {
  draft: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-600' },
  requested: { label: 'Demandé', cls: 'bg-blue-100 text-blue-700' },
  validated: { label: 'Validé', cls: 'bg-indigo-100 text-indigo-700' },
  prepared: { label: 'Préparé', cls: 'bg-cyan-100 text-cyan-700' },
  shipped: { label: 'Expédié', cls: 'bg-amber-100 text-amber-700' },
  in_transit: { label: 'En transit', cls: 'bg-orange-100 text-orange-700' },
  received: { label: 'Reçu', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Annulé', cls: 'bg-gray-200 text-gray-500' },
  rejected: { label: 'Rejeté', cls: 'bg-red-100 text-red-700' },
};

const TYPE_LABELS = {
  intra_warehouse: 'Intra-entrepôt',
  inter_warehouse: 'Inter-entrepôts',
  inter_store: 'Inter-magasins',
};

export default function TransferList({ storeUuid, onChanged }) {
  const { hasPermission } = useAuth();
  const { online } = usePWA();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [alert, setAlert] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [acting, setActing] = useState(null);

  const canValidate = hasPermission('inventory.transfer_validate');
  const canShip = hasPermission('inventory.transfer_ship');
  const canReceive = hasPermission('inventory.transfer_receive');
  const canCancel = hasPermission('inventory.transfer_cancel');
  const canRequest = hasPermission('inventory.stock_transfer');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (storeUuid) params.store = storeUuid;
      if (search) params.search = search;
      const res = await transfersAPI.list(1, params);
      setTransfers(res.data.results || res.data || []);
    } catch {
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, storeUuid, search]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn, uuid, successMsg) => {
    setActing(uuid);
    try {
      await fn(uuid);
      setAlert({ type: 'success', title: successMsg });
      await load();
      onChanged?.();
    } catch (err) {
      const msg = err.response?.data
        ? Object.values(err.response.data).flat().join(' ')
        : 'Action impossible.';
      setAlert({ type: 'error', title: 'Erreur', message: msg });
    } finally {
      setActing(null);
    }
  };

  const askConfirm = (title, message, onConfirm) =>
    setConfirm({ open: true, title, message, onConfirm });

  const actionsFor = (t) => {
    const acts = [];
    const busy = acting === t.uuid;
    if (t.status === 'draft' && canRequest) {
      acts.push({ icon: Send, label: 'Demander', fn: () => run(transfersAPI.request, t.uuid, 'Demande envoyée') });
    }
    if (t.status === 'requested' && canValidate) {
      acts.push({ icon: Check, label: 'Valider', fn: () => run(transfersAPI.validate, t.uuid, 'Transfert validé') });
      acts.push({
        icon: X, label: 'Rejeter', danger: true,
        fn: () => askConfirm('Rejeter le transfert', `Rejeter ${t.number} ?`,
          () => run(transfersAPI.reject, t.uuid, 'Transfert rejeté')),
      });
    }
    if (t.status === 'validated' && canShip) {
      acts.push({ icon: PackageCheck, label: 'Préparer', fn: () => run(transfersAPI.prepare, t.uuid, 'Transfert préparé') });
    }
    if (t.status === 'prepared' && canShip) {
      acts.push({
        icon: Truck, label: 'Expédier',
        fn: () => askConfirm('Expédier', `Expédier ${t.number} ? Le stock sortira de la source.`,
          () => run(transfersAPI.ship, t.uuid, 'Transfert expédié')),
      });
    }
    if (t.status === 'in_transit' && canReceive) {
      acts.push({
        icon: PackageOpen, label: 'Recevoir',
        fn: () => askConfirm('Recevoir', `Confirmer la réception de ${t.number} ?`,
          () => run(transfersAPI.receive, t.uuid, 'Transfert reçu')),
      });
    }
    if (!['received', 'cancelled', 'rejected'].includes(t.status) && canCancel) {
      acts.push({
        icon: Ban, label: 'Annuler', danger: true,
        fn: () => askConfirm('Annuler le transfert', `Annuler ${t.number} ?`,
          () => run(transfersAPI.cancel, t.uuid, 'Transfert annulé')),
      });
    }
    if (['draft', 'requested'].includes(t.status) && canCancel) {
      acts.push({
        icon: Trash2, label: 'Supprimer', danger: true,
        fn: () => askConfirm('Supprimer', `Supprimer définitivement ${t.number} ?`,
          async () => { await transfersAPI.remove(t.uuid); await load(); onChanged?.(); }),
      });
    }
    return acts.map((a) => ({ ...a, disabled: busy }));
  };

  if (loading) return <Loader fullscreen={false} />;

  // La liste des transferts exige le réseau (3.10) : hors ligne, seul le
  // transfert immédiat via le formulaire reste disponible.
  if (!online) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-8 text-center">
        <p className="text-muted text-lg">
          La liste des transferts nécessite une connexion.
        </p>
        <p className="text-muted text-sm mt-2">
          Hors ligne, vous pouvez uniquement créer un transfert immédiat
          via « Nouveau transfert ».
        </p>
      </div>
    );
  }

  return (
    <div>
      <AlertDialog alert={alert} onClose={() => setAlert(null)} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un numéro ou produit…"
            className={`${inputClass} pl-10`}
          />
        </div>
        <select
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className={inputClass}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {transfers.length === 0 ? (
        <p className="text-muted text-lg text-center py-8">Aucun transfert.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-muted text-sm">
                <th className="py-3 px-4 font-medium">Numéro</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">De → Vers</th>
                <th className="py-3 px-4 font-medium">Produits</th>
                <th className="py-3 px-4 font-medium text-center">Statut</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transfers.map((t) => {
                const meta = STATUS_META[t.status] || STATUS_META.draft;
                return (
                  <tr key={t.uuid} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-medium text-foreground">{t.number}</td>
                    <td className="py-3 px-4 text-muted">{TYPE_LABELS[t.transfer_type] || t.transfer_type}</td>
                    <td className="py-3 px-4 text-muted">
                      {t.from_store?.name}
                      {t.from_warehouse?.name ? ` · ${t.from_warehouse.name}` : ''}
                      <ArrowLeftRight size={12} className="inline mx-1" />
                      {t.to_store?.name}
                      {t.to_warehouse?.name ? ` · ${t.to_warehouse.name}` : ''}
                    </td>
                    <td className="py-3 px-4 text-muted">
                      {(t.items || []).map((i) => `${i.product?.name} ×${i.quantity_requested}`).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        {actionsFor(t).map((a) => {
                          const Icon = a.icon;
                          return (
                            <button
                              key={a.label} type="button" disabled={a.disabled}
                              onClick={() => { a.fn(); setConfirm({ open: false }); }}
                              title={a.label}
                              className={a.danger ? 'p-2 rounded-lg text-red-600 hover:bg-red-50' : btnIcon}
                            >
                              <Icon size={18} />
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirm.open} title={confirm.title} message={confirm.message}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm({ ...confirm, open: false })}
      />
    </div>
  );
}
