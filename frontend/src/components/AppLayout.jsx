import { useCallback, useEffect, useState } from 'react';
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

/**
 * Esc on a laptop goes one page back (to the Dashboard when there is no page to go back to).
 * Not while a popup or the menu is open (they close on Esc instead; they all lock the page scroll),
 * and Esc in a text box only leaves the box.
 */
function useEscapeBack() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.body.style.overflow === 'hidden' || document.querySelector('[role="dialog"]')) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) {
        el.blur();
        return;
      }
      if (window.history.state?.idx > 0) navigate(-1);
      else if (location.pathname !== '/') navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, location.pathname]);
}

export default function AppLayout() {
  const { isAuthenticated, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useEscapeBack();

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
