import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarClock, ChevronRight, Gauge, HandCoins, Plus, IndianRupee, Route, TrendingUp, Truck, Wallet,
} from 'lucide-react';
import useFetch from '../utils/useFetch';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatRupees, formatShortRupees, todayInput } from '../utils/format';
import { getDocTypeLabel } from '../utils/constants';
import StatCard from '../components/StatCard';
import TripPopup from '../components/TripPopup';
import ExpensePopup from '../components/ExpensePopup';
import PaymentPopup from '../components/PaymentPopup';
import { ReadingPopup } from './MeterReadings';
import { EmptyState, Loading, Page, PageHeader } from '../components/ui';

// Each quick add has its own colour: a strip down the left, a light tint, and a matching icon and + button
const QUICK_ACTIONS = [
  {
    key: 'trip', label: 'Add Trip', hint: 'Per trip, km or ton', icon: Route,
    strip: 'bg-blue-600', card: 'from-blue-50 ring-blue-200 hover:ring-blue-400', icon_: 'bg-blue-600 shadow-blue-600/30', plus: 'bg-blue-600/10 text-blue-700 group-hover:bg-blue-600 group-hover:text-white',
  },
  {
    key: 'expense', label: 'Add Expense', hint: 'Diesel, repair, toll', icon: Wallet,
    strip: 'bg-rose-600', card: 'from-rose-50 ring-rose-200 hover:ring-rose-400', icon_: 'bg-rose-600 shadow-rose-600/30', plus: 'bg-rose-600/10 text-rose-700 group-hover:bg-rose-600 group-hover:text-white',
  },
  {
    key: 'payment', label: 'Payment', hint: 'Money in or out', icon: HandCoins,
    strip: 'bg-emerald-600', card: 'from-emerald-50 ring-emerald-200 hover:ring-emerald-400', icon_: 'bg-emerald-600 shadow-emerald-600/30', plus: 'bg-emerald-600/10 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white',
  },
  {
    key: 'reading', label: 'Meter Reading', hint: 'Opening & closing km', icon: Gauge,
    strip: 'bg-amber-500', card: 'from-amber-50 ring-amber-200 hover:ring-amber-400', icon_: 'bg-amber-500 shadow-amber-500/30', plus: 'bg-amber-500/10 text-amber-700 group-hover:bg-amber-500 group-hover:text-white',
  },
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

      <section className="space-y-2">
        <h2 className="px-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Quick Add</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {QUICK_ACTIONS.map(({ key, label, hint, icon: Icon, strip, card, icon_: iconTone, plus }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPopup(key)}
              className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r to-white py-3 pl-4 pr-3 text-left shadow-xs ring-1 transition hover:-translate-y-0.5 hover:shadow-md md:py-4 md:pl-5 ${card}`}
            >
              <span className={`absolute inset-y-0 left-0 w-1.5 ${strip}`} aria-hidden="true" />
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md ${iconTone}`}><Icon size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-tight text-slate-800 sm:truncate">{label}</span>
                <span className="hidden truncate text-xs text-slate-500 sm:block">{hint}</span>
              </span>
              <span className={`hidden h-7 w-7 shrink-0 items-center justify-center rounded-full transition sm:flex ${plus}`}><Plus size={16} /></span>
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
      {popup === 'expense' && <ExpensePopup onClose={() => setPopup('')} onSaved={reload} />}
      {popup === 'payment' && <PaymentPopup onClose={() => setPopup('')} onSaved={reload} />}
      {popup === 'reading' && <ReadingPopup onClose={() => setPopup('')} onSaved={reload} />}
    </Page>
  );
}
