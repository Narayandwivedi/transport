import { useCallback, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronLeft, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AlertsProvider, useAlerts } from '../context/AlertsContext';
import AppSidebar from './AppSidebar';
import Logo from './Logo';
import { Loading } from './ui';

function MobileBar({ onMenu }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { alerts } = useAlerts();

  const handleBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/');
  };

  return (
    <nav className="no-print fixed inset-x-0 top-0 z-20 flex h-16 items-center border-b border-slate-200 bg-white/80 px-2 backdrop-blur-md lg:hidden">
      <div className="relative z-10 flex items-center gap-0.5">
        <button type="button" onClick={onMenu} className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100" aria-label="Open menu">
          <Menu size={24} />
        </button>
        {location.pathname !== '/' && (
          <button type="button" onClick={handleBack} className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Go back">
            <ChevronLeft size={24} />
          </button>
        )}
      </div>
      <Link to="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <Logo />
      </Link>
      <Link to="/alerts" className="relative z-10 ml-auto rounded-lg p-2 text-slate-700 transition hover:bg-slate-100" aria-label="Alerts">
        <Bell size={22} />
        {alerts?.count > 0 && (
          <span className="absolute right-0.5 top-0.5 min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white">{alerts.count}</span>
        )}
      </Link>
    </nav>
  );
}

export default function AppLayout() {
  const { isAuthenticated, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  if (loading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <AlertsProvider>
      <div className="min-h-screen bg-slate-50">
        <AppSidebar mobileOpen={menuOpen} onClose={closeMenu} />
        <MobileBar onMenu={() => setMenuOpen(true)} />
        <div className="print-reset lg:ml-[260px]">
          <div className="print-reset pt-16 lg:pt-0">
            <Outlet />
          </div>
        </div>
      </div>
    </AlertsProvider>
  );
}
