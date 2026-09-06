import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Bell, LogOut, ChevronDown, Store,
  Package, Users, Truck, Receipt, Loader2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { mediaUrl, productsAPI, customersAPI, suppliersAPI, salesAPI } from '../../lib/api';
import { setPendingSearch } from '../../lib/pendingSearch';
import SyncStatus from '../../pwa/SyncStatus';

// Sections interrogées par la recherche globale, avec la permission requise
// et la route (app + sous-section) vers laquelle rediriger au clic.
const SEARCH_SECTIONS = [
  {
    key: 'products', label: 'Produits', icon: Package, permission: 'products.view',
    api: (q) => productsAPI.list(1, q), app: 'products', sub: 'products-list',
    render: (item) => ({ title: item.name, subtitle: `${item.selling_price} FCFA` }),
  },
  {
    key: 'customers', label: 'Clients', icon: Users, permission: 'customers.view',
    api: (q) => customersAPI.list(1, q), app: 'customers', sub: null,
    render: (item) => ({ title: item.name, subtitle: item.phone || item.email || '' }),
  },
  {
    key: 'suppliers', label: 'Fournisseurs', icon: Truck, permission: 'suppliers.view',
    api: (q) => suppliersAPI.list(1, q), app: 'suppliers', sub: null,
    render: (item) => ({ title: item.name, subtitle: item.phone || item.email || '' }),
  },
  {
    key: 'sales', label: 'Ventes', icon: Receipt, permission: 'sales.view',
    api: (q) => salesAPI.list(1, q), app: 'sales', sub: 'sales-history',
    render: (item) => ({
      title: item.customer?.name || item.receipt?.receipt_number || `Vente #${item.uuid?.slice(0, 8)}`,
      subtitle: `${item.total_amount} FCFA`,
    }),
  },
];

// Topbar (_docs/07_UI_UX_DESIGN_GUIDELINES.txt, section 6) :
// logo entreprise, nom entreprise, recherche, notifications, profil utilisateur.
const Topbar = ({ roleLabel }) => {
  const { user, company, assignedStore, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const requestId = useRef(0);
  const searchBoxRef = useRef(null);

  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase();

  const sections = SEARCH_SECTIONS.filter((s) => hasPermission(s.permission));

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++requestId.current;
    setSearching(true);
    const t = setTimeout(async () => {
      const settled = await Promise.all(
        sections.map(async (section) => {
          try {
            const res = await section.api(trimmed);
            const items = (res.data.results || res.data || []).slice(0, 5);
            return { section, items };
          } catch {
            return { section, items: [] };
          }
        })
      );
      if (id === requestId.current) {
        setResults(settled.filter((r) => r.items.length > 0));
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const goToResult = (section) => {
    setPendingSearch(section.app, query.trim());
    const params = { app: section.app };
    if (section.sub) params.sub = section.sub;
    navigate({ pathname: '/dashboard', search: `?${new URLSearchParams(params).toString()}` });
    setSearchOpen(false);
    setQuery('');
  };

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 h-16 flex items-center px-4 md:px-6 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {company?.logo ? (
          <img src={mediaUrl(company.logo)} alt={company.name} className="w-9 h-9 rounded-lg object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
            <Store size={20} className="text-white" />
          </div>
        )}
        <span className="font-semibold text-gray-900 truncate text-[15px] md:text-base">
          {company?.name || 'Gestion Magasins'}
        </span>
      </div>

      <div className="flex-1 max-w-md hidden sm:block" ref={searchBoxRef}>
        <div className="relative">
          {searching ? (
            <Loader2 size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
          ) : (
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Rechercher un produit, client, fournisseur, vente..."
            aria-label="Rechercher"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
          />

          {searchOpen && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-2 max-h-96 overflow-y-auto z-20">
              {searching && results.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-500">Recherche...</p>
              )}
              {!searching && results.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-500">Aucun résultat pour « {query.trim()} ».</p>
              )}
              {results.map(({ section, items }) => (
                <div key={section.key} className="mb-1">
                  <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                    <section.icon size={14} />
                    {section.label}
                  </p>
                  {items.map((item) => {
                    const { title, subtitle } = section.render(item);
                    return (
                      <button
                        type="button"
                        key={item.uuid}
                        onClick={() => goToResult(section)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-gray-50"
                      >
                        <span className="text-[15px] text-gray-900 truncate">{title}</span>
                        {subtitle && <span className="text-sm text-gray-500 flex-shrink-0">{subtitle}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1" />

      <SyncStatus />

      <button
        type="button"
        aria-label="Notifications"
        className="relative w-11 h-11 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
      >
        <Bell size={24} />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 h-11 px-2 rounded-lg hover:bg-gray-100"
        >
          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center text-sm">
            {initials || '?'}
          </div>
          <div className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-[15px] font-medium text-gray-900">
              {user?.first_name} {user?.last_name}
            </span>
            {roleLabel && (
              <span className="text-xs text-gray-500">
                {roleLabel}
                {assignedStore ? ` — ${assignedStore.name}` : ''}
              </span>
            )}
          </div>
          <ChevronDown size={18} className="text-gray-400 hidden md:block" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1">
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 text-[15px] text-red-600 hover:bg-red-50"
            >
              <LogOut size={20} />
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
