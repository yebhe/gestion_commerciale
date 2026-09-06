import { NavLink } from 'react-router-dom';
import { Home, ShoppingCart, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Navigation mobile simplifiée (_docs/07_UI_UX_DESIGN_GUIDELINES.txt,
 * section 11) : Accueil, Caisse (si pos.access), puis ☰ Menu qui ouvre la
 * Sidebar complète (toutes les applications, _docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt)
 * en overlay.
 */
const MobileNav = ({ onMenuClick }) => {
  const { hasPermission } = useAuth();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 flex items-stretch h-16">
      <NavLink
        to="/dashboard"
        end
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium ${
            isActive ? 'text-primary-700' : 'text-gray-500'
          }`
        }
      >
        <Home size={26} />
        <span>Accueil</span>
      </NavLink>

      {hasPermission('pos.access') && (
        <NavLink
          to="/pos"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium ${
              isActive ? 'text-primary-700' : 'text-gray-500'
            }`
          }
        >
          <ShoppingCart size={26} />
          <span>Caisse</span>
        </NavLink>
      )}

      <button
        type="button"
        onClick={onMenuClick}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-gray-500"
      >
        <Menu size={26} />
        <span>Menu</span>
      </button>
    </nav>
  );
};

export default MobileNav;
