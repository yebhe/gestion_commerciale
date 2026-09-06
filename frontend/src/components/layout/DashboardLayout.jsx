import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileNav from './MobileNav';

/**
 * Layout partagé Owner/Manager : Sidebar desktop + Topbar + navigation
 * mobile simplifiée (_docs/07_UI_UX_DESIGN_GUIDELINES.txt, sections 6 et 11).
 */
const DashboardLayout = ({
  roleLabel,
  showSettings = true,
  showSidebar = true,
  showMobileNav = true,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {showSidebar && <Sidebar showSettings={showSettings} />}

      {showSidebar && mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="absolute inset-y-0 left-0 w-72 bg-white" onClick={(e) => e.stopPropagation()}>
            <Sidebar showSettings={showSettings} mobile />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar roleLabel={roleLabel} />
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">{children}</main>
      </div>

      {showMobileNav && <MobileNav onMenuClick={() => setMobileMenuOpen(true)} />}
    </div>
  );
};

export default DashboardLayout;
