import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, Printer, LogOut, Store as StoreIcon, Check, X, Package, Smartphone, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../../contexts/Loader';
import ConnectionStatus from '../../components/ui/ConnectionStatus';
import { productsAPI, storesAPI, salesAPI, mediaUrl } from '../../lib/api';
import { useOfflineMutation } from '../../pwa/useOfflineMutation';
import { useSyncRefresh } from '../../pwa';
import { applyPendingStock } from '../../pwa/applyPendingStock';
import { loadVariantsWithCache } from '../../pwa/preloadCache';
import db from '../../pwa/db';
import networkManager from '../../pwa/networkManager';

const formatFCFA = (amount) => `${Number(amount).toLocaleString('fr-FR')} FCFA`;

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'card', label: 'Carte' },
  { value: 'credit', label: 'Crédit' },
];

/**
 * Module POS / Caisse (_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt, section
 * "MODULE POS (CAISSE)") : route dédiée /pos, réservée aux utilisateurs
 * avec pos.access. Interface volontairement minimale — pas de gestion
 * utilisateurs, paramètres, rapports avancés ni administration.
 * Conçue pour un usage tactile, rapide, PWA offline-first.
 */
const POS = () => {
  const { user, logout, hasPermission, scope, assignedStore } = useAuth();
  const isCompanyScope = scope === 'COMPANY';

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStoreUuid, setSelectedStoreUuid] = useState(
    !isCompanyScope && assignedStore ? assignedStore.uuid : ''
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [mobileMoneySale, setMobileMoneySale] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  // Sélecteur de variante (étape 4.5) : { product, variants } ou null.
  const [variantPicker, setVariantPicker] = useState(null);
  const { mutate: createSale } = useOfflineMutation('pos', 'CREATE');

  const canPrint = hasPermission('pos.print_receipt');
  const canDiscount = hasPermission('pos.apply_discount');

  const loadStores = useCallback(async () => {
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
    } catch {
      /* ignore */
    }
  }, []);

  const loadProducts = useCallback(async () => {
    if (isCompanyScope && !selectedStoreUuid) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const storeParam = isCompanyScope ? selectedStoreUuid : (assignedStore?.uuid || '');
    try {
      const all = [];
      let p = 1;
      while (true) {
        const res = await productsAPI.list(p, '', storeParam);
        const results = res.data.results || res.data || [];
        all.push(...results);
        if (!res.data.next) break;
        p++;
        if (p > 50) break;
      }
      setProducts(await applyPendingStock(all, storeParam));
    } catch {
      try {
        const companyUuid = localStorage.getItem('current_company_uuid') || '';
        const cached = await db.products.where('company_uuid').equals(companyUuid).toArray();
        const all = cached.filter((p) => !p.is_deleted && (!storeParam || !p.store_uuid || p.store_uuid === storeParam));
        setProducts(await applyPendingStock(all, storeParam));
      } catch {
        setError('Impossible de charger les produits.');
      }
    } finally {
      setLoading(false);
    }
  }, [isCompanyScope, selectedStoreUuid, assignedStore]);

  useSyncRefresh(loadProducts);

  useEffect(() => {
    if (isCompanyScope) loadStores();
  }, [loadStores, isCompanyScope]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search))
  );

  const getStoreStock = (product) => {
    const storeUuid = selectedStoreUuid || assignedStore?.uuid;
    return product.stock_by_store?.find((s) => s.store?.uuid === storeUuid)?.quantity ?? product.stock_quantity ?? 0;
  };

  // Clé de ligne panier : produit + variante éventuelle (étape 4.5).
  const cartKey = (product, variant) =>
    `${product.uuid}:${variant?.uuid || ''}`;

  const pushToCart = (product, variant = null) => {
    const key = cartKey(product, variant);
    const price = variant?.selling_price ?? product.selling_price;
    const available = getStoreStock(product);
    const inCart = cart.find((item) => item.key === key)?.qty || 0;
    if (inCart + 1 > available) {
      setError(`Stock insuffisant pour « ${product.name} » : ${available} disponible(s).`);
      return;
    }
    setError('');
    setCart((prev) => {
      const existing = prev.find((item) => item.key === key);
      if (existing) {
        return prev.map((item) =>
          item.key === key ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, {
        ...product, key, qty: 1,
        variant: variant || null,
        variant_label: variant
          ? Object.values(variant.attributes || {}).join(' / ') || variant.sku
          : null,
        selling_price: price,
      }];
    });
  };

  const addToCart = async (product) => {
    // Si le produit a des variantes actives, on propose le choix (4.5).
    try {
      const variants = (await loadVariantsWithCache(product.uuid))
        .filter((v) => v.is_active !== false);
      if (variants.length) {
        setVariantPicker({ product, variants });
        return;
      }
    } catch { /* pas de variantes accessibles : produit générique */ }
    pushToCart(product);
  };

  const updateQty = (key, delta) => {
    setCart((prev) => {
      const item = prev.find((i) => i.key === key);
      if (item && delta > 0) {
        const available = getStoreStock(item);
        if (item.qty + delta > available) {
          setError(`Stock insuffisant : ${available} disponible(s).`);
          return prev;
        }
      }
      setError('');
      return prev
        .map((item) => (item.key === key ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0);
    });
  };

  const removeFromCart = (key) => setCart((prev) => prev.filter((item) => item.key !== key));

  const total = cart.reduce((sum, item) => sum + Number(item.selling_price) * item.qty, 0);

  const handlePayment = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError('');
    for (const item of cart) {
      const product = products.find((p) => p.uuid === item.uuid);
      const available = product ? getStoreStock(product) : getStoreStock(item);
      if (item.qty > available) {
        setError(`Stock insuffisant pour ${item.name} : ${available} disponible(s).`);
        setSubmitting(false);
        return;
      }
    }
    try {
      const saleData = {
        store: selectedStoreUuid || (assignedStore?.uuid || undefined),
        payment_method: paymentMethod,
        status: paymentMethod === 'mobile_money' ? 'pending' : 'completed',
        items: cart.map((item) => ({
          product: item.uuid,
          variant: item.variant?.uuid || undefined,
          quantity: item.qty,
          unit_price: item.selling_price,
        })),
      };

      // Le mobile money ne peut pas fonctionner hors ligne
      if (paymentMethod === 'mobile_money' && !navigator.onLine) {
        setError('Le Mobile Money nécessite une connexion Internet.');
        setSubmitting(false);
        return;
      }

      const res = await createSale(saleData, {
        company_uuid: localStorage.getItem('current_company_uuid'),
        store_uuid: selectedStoreUuid || assignedStore?.uuid,
        user_uuid: user?.uuid,
      });

      if (paymentMethod === 'mobile_money') {
        const mmRes = await salesAPI.initiateMobileMoney(res.uuid);
        setMobileMoneySale(mmRes.data);
        setCart([]);
        loadProducts();
        return;
      }

      setLastSale(res);
      setCart([]);
      setShowPaymentModal(false);
      loadProducts();
    } catch (err) {
      const responseData = err.response?.data;
      const message = responseData
        ? Object.values(responseData).flat().join(' ')
        : 'Impossible d\'enregistrer la vente. Veuillez réessayer.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const checkMobileMoneyStatus = async () => {
    if (!mobileMoneySale) return;
    setCheckingPayment(true);
    try {
      const res = await salesAPI.retrieve(mobileMoneySale.uuid);
      setMobileMoneySale(res.data);
      if (res.data.status === 'completed') {
        setLastSale(res.data);
        setShowPaymentModal(false);
      }
    } catch {
      setError('Impossible de vérifier le statut du paiement.');
    } finally {
      setCheckingPayment(false);
    }
  };

  const closeMobileMoneyScreen = () => {
    setMobileMoneySale(null);
    setShowPaymentModal(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3 min-w-0">
          {isCompanyScope && (
            <select
              value={selectedStoreUuid}
              onChange={(e) => setSelectedStoreUuid(e.target.value)}
              className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sélectionner un magasin</option>
              {stores.map((s) => (
                <option key={s.uuid} value={s.uuid}>{s.name}</option>
              ))}
            </select>
          )}
          {!isCompanyScope && assignedStore && (
            <span className="flex items-center gap-2 text-[15px] font-semibold text-gray-900 truncate">
              <StoreIcon size={20} className="text-primary-600" />
              {assignedStore.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-semibold text-gray-900 truncate hidden sm:inline">
            {user?.first_name} {user?.last_name}
          </span>
          <ConnectionStatus />
          <button
            type="button"
            onClick={logout}
            aria-label="Déconnexion"
            className="w-11 h-11 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
          >
            <LogOut size={22} />
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Recherche produit + grille tactile */}
        <section className="lg:col-span-2 flex flex-col gap-4">
          <div className="relative">
            <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit ou scanner un code-barres..."
              aria-label="Rechercher un produit"
              className="w-full h-14 pl-12 pr-4 rounded-xl border border-gray-200 bg-white text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {isCompanyScope && !selectedStoreUuid ? (
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-8 text-center">
              <StoreIcon size={40} className="text-primary-400 mx-auto mb-3" />
              <p className="text-gray-600">Veuillez sélectionner un magasin pour commencer.</p>
            </div>
          ) : loading ? (
            <Loader fullscreen={false} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.uuid}
                  type="button"
                  onClick={() => addToCart(product)}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:border-primary-400 hover:shadow-md transition-all active:scale-95"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {product.image ? (
                        <img src={mediaUrl(product.image)} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={22} className="text-primary-600" />
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 text-[15px] truncate">{product.name}</p>
                  </div>
                  <p className="text-primary-700 font-bold">{formatFCFA(product.selling_price)}</p>
                  <p className="text-gray-400 text-xs mt-1">Stock: {product.stock_by_store?.find((s) => s.store?.uuid === (selectedStoreUuid || assignedStore?.uuid))?.quantity ?? product.stock_quantity}</p>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <p className="col-span-full text-gray-500 text-center py-8">Aucun produit trouvé.</p>
              )}
            </div>
          )}
        </section>

        {/* Panier + paiement */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col h-fit lg:sticky lg:top-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Panier</h2>

          {cart.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Panier vide</p>
          ) : (
            <ul className="divide-y divide-gray-100 mb-4 max-h-[40vh] overflow-y-auto">
              {cart.map((item) => (
                <li key={item.key} className="py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-[15px] truncate">
                      {item.name}
                      {item.variant_label && (
                        <span className="text-primary-600 font-normal"> · {item.variant_label}</span>
                      )}
                    </p>
                    <p className="text-gray-500 text-sm">{formatFCFA(item.selling_price)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQty(item.key, -1)}
                      aria-label="Diminuer la quantité"
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-6 text-center font-semibold">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.key, 1)}
                      aria-label="Augmenter la quantité"
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.key)}
                      aria-label="Retirer du panier"
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-gray-100 pt-4 mt-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 font-medium">Total</span>
              <span className="text-2xl font-bold text-gray-900">{formatFCFA(total)}</span>
            </div>

            {canDiscount && (
              <button
                type="button"
                className="w-full h-11 mb-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
              >
                Appliquer une remise
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              disabled={cart.length === 0}
              className="w-full h-14 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-lg font-bold shadow-md"
            >
              Encaisser
            </button>

            {canPrint && lastSale && (
              <button
                type="button"
                className="w-full h-11 mt-2 flex items-center justify-center gap-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
              >
                <Printer size={18} />
                Imprimer le reçu
              </button>
            )}
          </div>
        </section>
      </main>

      {/* Choix de variante (étape 4.5) : affiché quand le produit
          ajouté possède des variantes actives. */}
      {variantPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {variantPicker.product.name} — choisir une variante
              </h3>
              <button type="button" onClick={() => setVariantPicker(null)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {variantPicker.variants.map((v) => (
                <button
                  key={v.uuid}
                  type="button"
                  onClick={() => {
                    pushToCart(variantPicker.product, v);
                    setVariantPicker(null);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-primary-400 hover:bg-primary-50 text-left"
                >
                  <span className="font-medium text-gray-900">
                    {Object.entries(v.attributes || {})
                      .map(([k, val]) => `${k}: ${val}`).join(' / ') || v.sku || 'Variante'}
                  </span>
                  <span className="text-primary-700 font-semibold">
                    {formatFCFA(v.selling_price ?? variantPicker.product.selling_price)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {mobileMoneySale ? 'Paiement Mobile Money' : 'Paiement'}
              </h2>
              <button
                type="button"
                onClick={mobileMoneySale ? closeMobileMoneyScreen : () => setShowPaymentModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <X size={22} />
              </button>
            </div>

            {mobileMoneySale ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-gray-500 font-medium">Montant</span>
                  <span className="text-2xl font-bold text-gray-900">{formatFCFA(mobileMoneySale.total_amount)}</span>
                </div>

                <div className="bg-primary-50 border border-primary-200 rounded-xl p-5 mb-4 text-center">
                  <Smartphone size={36} className="text-primary-600 mx-auto mb-3" />
                  {mobileMoneySale.status === 'completed' ? (
                    <p className="text-green-700 font-semibold">Paiement reçu avec succès.</p>
                  ) : (
                    <>
                      <p className="text-gray-700 mb-3">
                        Demandez au client d'ouvrir ce lien pour payer via Orange Money, MTN MoMo, PayCard...
                      </p>
                      {mobileMoneySale.mobile_money_payment?.payment_url && (
                        <a
                          href={mobileMoneySale.mobile_money_payment.payment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full h-12 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold flex items-center justify-center"
                        >
                          Ouvrir le lien de paiement
                        </a>
                      )}
                    </>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
                    {error}
                  </div>
                )}

                {mobileMoneySale.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={checkMobileMoneyStatus}
                    disabled={checkingPayment}
                    className="w-full h-12 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={18} className={checkingPayment ? 'animate-spin' : ''} />
                    {checkingPayment ? 'Vérification...' : 'Vérifier le paiement'}
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-gray-500 font-medium">Total à payer</span>
                  <span className="text-2xl font-bold text-gray-900">{formatFCFA(total)}</span>
                </div>

                <label className="block text-sm font-medium text-gray-700 mb-2">Méthode de paiement</label>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentMethod(method.value)}
                      className={`h-12 rounded-xl border-2 font-medium transition-all ${
                        paymentMethod === method.value
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePayment}
                  disabled={submitting}
                  className="w-full h-14 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-lg font-bold shadow-md flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    'Enregistrement...'
                  ) : (
                    <>
                      <Check size={22} />
                      Valider la vente
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
