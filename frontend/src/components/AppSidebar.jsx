import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Bell, Route, CalendarClock, Wallet, Package, Gauge, Wrench, FileBadge, ChartColumn,
  Calculator, FileText, Users, Truck, HandCoins, Settings, X, IdCard, UserRound, Boxes, Fuel, Droplet,
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { useAlerts } from '../context/AlertsContext';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/alerts', icon: Bell, label: 'Alerts', badge: 'alerts' },
      { to: '/reports', icon: ChartColumn, label: 'Profit Reports' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/trips', icon: Route, label: 'Trips' },
      { to: '/monthly-hire', icon: CalendarClock, label: 'Monthly Hire' },
      { to: '/payments', icon: HandCoins, label: 'Payments' },
      { to: '/expenses', icon: Wallet, label: 'Expenses' },
      { to: '/diesel', icon: Fuel, label: 'Diesel' },
      { to: '/inventory', icon: Package, label: 'Stock & Purchase' },
      { to: '/payroll', icon: IdCard, label: 'Payroll' },
    ],
  },
  {
    label: 'Fleet Care',
    items: [
      { to: '/meter-readings', icon: Gauge, label: 'Meter Reading' },
      { to: '/mileage', icon: Droplet, label: 'Mileage' },
      { to: '/maintenance', icon: Wrench, label: 'Maintenance' },
      { to: '/documents', icon: FileBadge, label: 'Documents' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/calculator', icon: Calculator, label: 'Cost Calculator' },
      { to: '/quotations', icon: FileText, label: 'Quotations' },
    ],
  },
  {
    label: 'Masters',
    items: [
      { to: '/vehicles', icon: Truck, label: 'Vehicles' },
      { to: '/parties', icon: Users, label: 'Parties' },
      { to: '/drivers', icon: UserRound, label: 'Drivers' },
      { to: '/stock-items', icon: Boxes, label: 'Stock Items' },
    ],
  },
];

const SETTINGS_PATH = '/settings';
const NAV_PATHS = [...navGroups.flatMap((group) => group.items.map((item) => item.to)), SETTINGS_PATH];

const matchesPath = (pathname, path) => (
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)
);

// Only the longest matching entry is active
const getActivePath = (pathname) => NAV_PATHS
  .filter((path) => matchesPath(pathname, path))
  .sort((a, b) => b.length - a.length)[0];

const NavItem = ({ to, icon: Icon, label, isActive, badge }) => (
  <Link
    to={to}
    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
      isActive
        ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
        isActive
          ? 'bg-white/20 text-white'
          : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-primary-600'
      }`}
    >
      <Icon size={18} />
    </span>
    <span className="truncate">{label}</span>
    {badge > 0 && (
      <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${isActive ? 'bg-white text-primary-700' : 'bg-rose-600 text-white'}`}>{badge}</span>
    )}
  </Link>
);

export default function AppSidebar({ mobileOpen = false, onClose }) {
  const { user } = useAuth();
  const { alerts } = useAlerts();
  const location = useLocation();
  const activePath = getActivePath(location.pathname);
  const badges = { alerts: alerts?.count || 0 };

  // Close the mobile drawer after navigating
  useEffect(() => {
    onClose?.();
  }, [location.pathname, onClose]);

  // While the mobile drawer is open: Esc closes it and the page behind stops scrolling
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen, onClose]);

  const content = (
    <div className="relative flex h-full flex-col">
      <div className="flex-none px-4 pb-4 pt-5">
        <div className="flex items-center justify-center">
          <Link to="/" className="flex items-center justify-center">
            <Logo subtitle={user?.companyName || 'Transport Management'} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="mx-5 h-px bg-slate-200" />

      <div className="scrollbar-hide flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{group.label}</p>
            <nav className="space-y-1">
              {group.items.map((item) => (
                <NavItem key={item.to} {...item} badge={item.badge ? badges[item.badge] : 0} isActive={item.to === activePath} />
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="flex-none border-t border-slate-200 p-3">
        <NavItem to={SETTINGS_PATH} icon={Settings} label="Settings" isActive={activePath === SETTINGS_PATH} />
      </div>
    </div>
  );

  return (
    <>
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-slate-200 bg-white lg:flex">
        {content}
      </aside>

      <div className={`no-print fixed inset-0 z-[60] lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`} aria-hidden={!mobileOpen}>
        <div
          className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-200 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          {content}
        </aside>
      </div>
    </>
  );
}
