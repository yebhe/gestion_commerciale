import { X } from 'lucide-react';
import {
  PAYMENT_LABELS, PAYMENT_STYLES, STATUS_LABELS, STATUS_STYLES,
} from './constants';

const SaleDetail = ({ sale, onClose }) => {
  if (!sale) return null;

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 mb-6 relative">
      <button type="button" onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-gray-100">
        <X size={24} />
      </button>

      <h2 className="text-xl font-bold text-foreground mb-4">
        Détails de la vente — {sale.receipt?.receipt_number || sale.uuid.slice(0, 8)}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm text-muted">Date</p>
          <p className="text-base font-medium text-foreground">
            {new Date(sale.created_at).toLocaleString('fr-FR')}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted">Client</p>
          <p className="text-base font-medium text-foreground">
            {sale.customer?.name || 'Client de passage'}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted">Caissier</p>
          <p className="text-base font-medium text-foreground">
            {sale.cashier?.first_name} {sale.cashier?.last_name || sale.cashier?.email}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted">Magasin</p>
          <p className="text-base font-medium text-foreground">
            {sale.store?.name || '—'}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted">Paiement</p>
          <span className={`inline-block text-sm font-medium px-3 py-1 rounded-full ${PAYMENT_STYLES[sale.payment_method] || 'bg-gray-100 text-gray-600'}`}>
            {PAYMENT_LABELS[sale.payment_method] || sale.payment_method}
          </span>
        </div>
        <div>
          <p className="text-sm text-muted">Statut</p>
          <span className={`inline-block text-sm font-medium px-3 py-1 rounded-full ${STATUS_STYLES[sale.status] || 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABELS[sale.status] || sale.status}
          </span>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-3">Articles</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-4">Produit</th>
              <th className="py-2 px-4">Qté</th>
              <th className="py-2 px-4">Prix unitaire</th>
              <th className="py-2 px-4">Remise</th>
              <th className="py-2 pl-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items?.map((item, idx) => (
              <tr key={idx} className="border-b border-border">
                <td className="py-3 pr-4 font-medium text-foreground">
                  {item.product?.name || 'Produit supprimé'}
                </td>
                <td className="py-3 px-4 text-muted">{item.quantity}</td>
                <td className="py-3 px-4 text-muted">{item.unit_price} FCFA</td>
                <td className="py-3 px-4 text-muted">{item.discount || 0} FCFA</td>
                <td className="py-3 pl-4 text-right font-semibold text-foreground">
                  {(item.quantity * item.unit_price - (item.discount || 0)).toFixed(2)} FCFA
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="4" className="py-3 text-right font-semibold text-foreground">Total</td>
              <td className="py-3 pl-4 text-right text-xl font-bold text-primary-600">
                {sale.total_amount} FCFA
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default SaleDetail;
