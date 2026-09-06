import {
  Search, ChevronLeft, ChevronRight, ShoppingCart, RotateCcw, Store,
} from 'lucide-react';
import Loader from '../../../contexts/Loader';
import {
  PAYMENT_LABELS, PAYMENT_STYLES, STATUS_LABELS, STATUS_STYLES,
  btnSecondary, btnDanger,
} from './constants';

const RefundsList = ({
  sales, loading, search, page, count, next, prev,
  isCompanyScope, selectedStoreUuid,
  canRefund, canCancel,
  onSearchChange, onPageChange, onRefund, onCancel,
}) => (
  <>
    {!(isCompanyScope && !selectedStoreUuid) && (
      <div className="relative mb-4">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher une vente..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    )}

    {isCompanyScope && !selectedStoreUuid ? (
      <div className="bg-primary-50 border border-primary-200 rounded-2xl p-8 text-center">
        <Store size={40} className="text-primary-400 mx-auto mb-3" />
        <p className="text-lg text-muted">Veuillez sélectionner un magasin pour voir les remboursements.</p>
      </div>
    ) : loading ? (
      <Loader fullscreen={false} />
    ) : sales.length === 0 ? (
      <p className="text-muted text-lg">Aucune vente à rembourser ou annuler.</p>
    ) : (
      <ul className="divide-y divide-border bg-surface rounded-2xl border border-border">
        {sales.map((sale) => (
          <li key={sale.uuid} className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <ShoppingCart size={24} className="text-primary-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">
                  {sale.receipt?.receipt_number || `Vente ${sale.uuid.slice(0, 8)}`}
                </p>
                <p className="text-base text-muted">
                  {sale.customer?.name || 'Client de passage'} — {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${PAYMENT_STYLES[sale.payment_method] || 'bg-gray-100 text-gray-600'}`}>
                {PAYMENT_LABELS[sale.payment_method] || sale.payment_method}
              </span>
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${STATUS_STYLES[sale.status] || 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[sale.status] || sale.status}
              </span>
              <span className="text-lg font-bold text-foreground">{sale.total_amount} FCFA</span>
              {sale.status === 'completed' && canRefund && (
                <button onClick={() => onRefund(sale)} className={btnDanger}>
                  <RotateCcw size={18} />
                  Rembourser
                </button>
              )}
              {sale.status === 'completed' && canCancel && (
                <button onClick={() => onCancel(sale)} className={btnDanger}>
                  Annuler
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    )}

    {(next || prev) && (
      <div className="flex items-center justify-between mt-6">
        <p className="text-muted text-base">{count} vente(s) au total</p>
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))} disabled={!prev}
            className={`${btnSecondary} ${!prev ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <ChevronLeft size={20} />
            Précédent
          </button>
          <span className="text-base font-medium text-foreground">Page {page}</span>
          <button type="button"
            onClick={() => onPageChange(page + 1)} disabled={!next}
            className={`${btnSecondary} ${!next ? 'opacity-40 cursor-not-allowed' : ''}`}>
            Suivant
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    )}
  </>
);

export default RefundsList;
