import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarClock, ChevronRight, Fuel, Gauge, HandCoins, IndianRupee, PackageMinus, Route, Send, ShoppingCart, TrendingUp, Truck, Wallet,
} from 'lucide-react';
import useFetch from '../utils/useFetch';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatRupees, formatShortRupees, todayInput } from '../utils/format';
import { getDocTypeLabel } from '../utils/constants';
import StatCard from '../components/StatCard';
import TripPopup from '../components/TripPopup';
import ExpensePopup from '../components/ExpensePopup';
import PaymentPopup from '../components/PaymentPopup';
import PurchasePopup from '../components/PurchasePopup';
import DieselPopup from '../components/DieselPopup';
import { TxnPopup } from '../components/InventoryPopups';
import { ReadingPopup } from './MeterReadings';
import { EmptyState, Loading, Page, PageHeader } from '../components/ui';

// Quick entry tiles: small white tiles on a blue band, so many fit in little space
const QUICK_ENTRIES = [
  { key: 'trip', label: 'Add Trip', icon: Route, tone: 'bg-blue-50 text-blue-700 ring-blue-100' },
  { key: 'diesel', label: 'Diesel Purchase', icon: Fuel, tone: 'bg-orange-50 text-orange-700 ring-orange-100' },
  { key: 'expense', label: 'Add Expense', icon: Wallet, tone: 'bg-rose-50 text-rose-700 ring-rose-100' },
  { key: 'received', label: 'Money Received', icon: HandCoins, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  { key: 'paid', label: 'Money Paid', icon: Send, tone: 'bg-amber-50 text-amber-700 ring-amber-100' },
  { key: 'reading', label: 'Meter Reading', icon: Gauge, tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
  { key: 'purchase', label: 'Add Purchase', icon: ShoppingCart, tone: 'bg-violet-50 text-violet-700 ring-violet-100' },
  { key: 'issue', label: 'Issue Stock', icon: PackageMinus, tone: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
];

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [popup, setPopup] = useState('');
  const { data, loading, reload } = useFetch('/dashboard');
  // Stock items, fetched only while a purchase or an issue is being added
  const { data: stockItems, reload: reloadStockItems } = useFetch(popup === 'purchase' || popup === 'issue' ? '/inventory/items' : '', {}, []);

  if (loading && !data) return <Page><Loading /></Page>;
  if (!data) return <Page><EmptyState title="Could not load the dashboard" hint="Check that the backend is running." /></Page>;

  const { profit, trend, alerts, recentTrips, receivable, payable, vehicles, hiredIn, givenOut } = data;
  const totals = profit.totals;
  const topVehicles = profit.vehicles.filter((row) => row.income || row.cost).slice(0, 6);

  return (
    <Page>
      <PageHeader title={`${greeting()}, ${user?.name?.split(' ')[0] || ''}`} subtitle={`${user?.companyName || 'Your transport business'} · ${formatDate(todayInput())}`}>
        <Link to="/reports" className="btn-secondary">Full Report <ChevronRight size={16} /></Link>
      </PageHeader>

      {alerts.count > 0 && (
        <Link to="/alerts" className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition hover:brightness-95 ${alerts.urgent ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <AlertTriangle size={20} className="shrink-0" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold">{alerts.count} alert{alerts.count === 1 ? '' : 's'} need attention</p>
            <p className="truncate text-xs">
              {[
                ...alerts.documents.slice(0, 3).map((doc) => `${doc.vehicleId?.vehicleNo} ${getDocTypeLabel(doc.docType)} ${doc.daysLeft < 0 ? 'expired' : `in ${doc.daysLeft}d`}`),
                ...alerts.maintenance.slice(0, 2).map((task) => `${task.vehicleId?.vehicleNo} ${task.title}`),
                ...(alerts.licenses || []).slice(0, 2).map((employee) => `${employee.name} licence ${employee.daysLeft < 0 ? 'expired' : `in ${employee.daysLeft}d`}`),
              ].join(' · ')}
            </p>
          </div>
          <ChevronRight size={18} />
        </Link>
      )}

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard icon={IndianRupee} tone="emerald" label="Income This Month" value={formatRupees(totals.income)} hint={`${totals.trips} trips + monthly rent`} />
        <StatCard icon={Wallet} tone="rose" label="Cost This Month" value={formatRupees(totals.cost)} hint="Hire, rent, expenses" />
        <StatCard icon={TrendingUp} tone={totals.profit >= 0 ? 'blue' : 'rose'} label="Profit This Month" value={formatRupees(totals.profit)} hint="Whole business" />
        <StatCard icon={Truck} tone="indigo" label="Active Vehicles" value={vehicles.total} hint={`${vehicles.own} mine · ${vehicles.hired} hired`} />
        <StatCard compact icon={ArrowDownLeft} tone="teal" label="To Receive" value={formatRupees(receivable)} hint="From parties" />
        <StatCard compact icon={ArrowUpRight} tone="amber" label="To Pay" value={formatRupees(payable)} hint="Owners & suppliers" />
        <StatCard compact icon={CalendarClock} tone="slate" label="Hired In (monthly)" value={hiredIn} />
        <StatCard compact icon={CalendarClock} tone="slate" label="Given Out (monthly)" value={givenOut} />
      </section>

      <section className="panel @container bg-gradient-to-r from-[#1f2a3c] via-[#27374f] to-[#314866] ring-[#1f2a3c]">
        <div className="panel-header border-white/15 py-2.5">
          <h2 className="text-sm font-bold text-white">Quick Entry</h2>
          <p className="text-xs text-slate-300">Add today's entries without leaving the dashboard</p>
        </div>
        {/*
          Columns follow the panel's own width. Phones and tablets: four tiles a row, the icon above the label
          (beside it once there is room). Wide screens: all eight in one row.
        */}
        <div className="grid grid-cols-4 gap-1.5 p-2 @xl:gap-2 @xl:p-2.5 @5xl:grid-cols-8 md:gap-2.5 md:p-3">
          {QUICK_ENTRIES.map(({ key, label, icon: Icon, tone }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPopup(key)}
              className="group flex flex-col items-center gap-1 rounded-lg bg-white px-1 py-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-50 hover:shadow-md @xl:flex-row @xl:gap-2 @xl:rounded-xl @xl:p-2 @xl:text-left @5xl:flex-col @5xl:gap-1 @5xl:px-1 @5xl:text-center @[90rem]:flex-row @[90rem]:gap-2 @[90rem]:px-2 @[90rem]:text-left"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset @xl:h-8 @xl:w-8 ${tone}`}>
                <Icon className="h-4 w-4 @xl:h-[17px] @xl:w-[17px]" />
              </span>
              <span className="min-w-0 text-[11px] font-semibold leading-tight text-slate-700 group-hover:text-slate-900 @xl:text-[13px] @5xl:text-[12px] @[90rem]:text-[13px]">{label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <section className="panel">
          <div className="panel-header py-2.5"><h2 className="text-sm font-bold text-slate-800">Last 6 Months</h2></div>
          <div className="h-72 p-3 md:p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatShortRupees} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={(value) => formatRupees(value)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="cost" name="Cost" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Line dataKey="profit" name="Profit" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header flex items-center justify-between py-2.5">
            <h2 className="text-sm font-bold text-slate-800">Vehicle Profit · This Month</h2>
            <Link to="/reports" className="text-xs font-semibold text-primary-600 hover:underline">All</Link>
          </div>
          {topVehicles.length === 0 ? <EmptyState title="No activity yet this month" /> : (
            <ul className="divide-y divide-slate-100">
              {topVehicles.map((row) => (
                <li key={row.vehicleId} className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50" onClick={() => navigate(`/vehicles/${row.vehicleId}`)}>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-slate-800">{row.vehicleNo}</p>
                    <p className="text-xs text-slate-500">In {formatRupees(row.income)} · Out {formatRupees(row.cost)}</p>
                  </div>
                  <span className={`text-sm font-bold ${row.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatRupees(row.profit)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-header flex items-center justify-between py-2.5">
          <h2 className="text-sm font-bold text-slate-800">Recent Trips</h2>
          <Link to="/trips" className="text-xs font-semibold text-primary-600 hover:underline">All trips</Link>
        </div>
        {recentTrips.length === 0 ? <EmptyState title="No trips yet" hint='Use "Add Trip" above.' /> : (
          <ul className="divide-y divide-slate-100">
            {recentTrips.map((trip) => (
              <li key={trip._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    <span className="font-mono">{trip.vehicleId?.vehicleNo}</span> · {trip.partyId?.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">{formatDate(trip.date)} · {[trip.from, trip.to].filter(Boolean).join(' → ') || trip.tripNo}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-700">{formatRupees(trip.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {popup === 'trip' && <TripPopup onClose={() => setPopup('')} onSaved={reload} />}
      {popup === 'diesel' && <DieselPopup onClose={() => setPopup('')} onSaved={reload} />}
      {popup === 'expense' && <ExpensePopup onClose={() => setPopup('')} onSaved={reload} />}
      {(popup === 'received' || popup === 'paid') && <PaymentPopup preset={{ type: popup }} onClose={() => setPopup('')} onSaved={reload} />}
      {popup === 'reading' && <ReadingPopup onClose={() => setPopup('')} onSaved={reload} />}
      {popup === 'purchase' && <PurchasePopup items={stockItems || []} onClose={() => setPopup('')} onSaved={reload} onItemAdded={reloadStockItems} />}
      {popup === 'issue' && <TxnPopup items={stockItems || []} preset={{ type: 'issue' }} onClose={() => setPopup('')} onSaved={reload} />}
    </Page>
  );
}
