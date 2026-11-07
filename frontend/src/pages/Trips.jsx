import { useState } from 'react';
import { HandCoins, IndianRupee, Pencil, Plus, Route, Trash2, TrendingUp, Truck } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import useMasters from '../utils/useMasters';
import { currentMonthInput, formatDate, formatNumber, formatRupees, monthBounds } from '../utils/format';
import { describeCharge } from '../utils/constants';
import StatCard from '../components/StatCard';
import MonthFilter from '../components/MonthFilter';
import TripPopup from '../components/TripPopup';
import { VehicleSelect } from '../components/Pickers';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, RowAction, TD, TH } from '../components/ui';

const STATUS = {
  planned: { label: 'Planned', className: 'badge-blue' },
  running: { label: 'On the way', className: 'badge-orange' },
  completed: { label: 'Completed', className: 'badge-green' },
};

// Paid on the trip itself: all, some or nothing
const PAYMENT = {
  full: { label: 'Paid', className: 'badge-green' },
  partial: { label: 'Partial', className: 'badge-orange' },
  credit: { label: 'Credit', className: 'badge-gray' },
};

export default function Trips() {
  const [month, setMonth] = useState(currentMonthInput());
  const [vehicleId, setVehicleId] = useState('');
  const [search, setSearch] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [editing, setEditing] = useState(null);
  const { vehicles } = useMasters();
  const { data: trips, loading, error, reload } = useFetch('/trips', { ...monthBounds(month), vehicleId, search, paymentType }, []);

  const list = trips || [];
  const billed = list.reduce((total, trip) => total + trip.amount, 0);
  const received = list.reduce((total, trip) => total + (trip.receivedAmount || 0), 0);
  const hire = list.reduce((total, trip) => total + trip.hireAmount, 0);
  const km = list.reduce((total, trip) => total + (trip.billingBasis === 'per_km' ? trip.quantity : Math.max(0, trip.endKm - trip.startKm)), 0);

  const handleDelete = async (trip) => {
    if (!window.confirm(`Delete trip ${trip.tripNo}?`)) return;
    try {
      await apiClient.delete(`/trips/${trip._id}`);
      toast.success('Trip deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Page>
      <PageHeader title="Trips" subtitle="Every load carried, billed per trip, per km or per ton">
        <button type="button" className="btn-primary" onClick={() => setEditing({})}><Plus size={18} /> Add Trip</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-5">
        <StatCard compact icon={Route} tone="indigo" label="Trips" value={list.length} hint={`${formatNumber(km, 0)} km run`} />
        <StatCard compact icon={IndianRupee} tone="emerald" label="Billed" value={formatRupees(billed)} />
        <StatCard compact icon={HandCoins} tone={billed - received > 0 ? 'amber' : 'emerald'} label="Received on Trips" value={formatRupees(received)} hint={`On credit ${formatRupees(billed - received)}`} />
        <StatCard compact icon={Truck} tone="amber" label="Hire Paid (trips)" value={formatRupees(hire)} hint="To owners of hired vehicles" />
        <StatCard compact icon={TrendingUp} tone="blue" label="Trip Margin" value={formatRupees(billed - hire)} hint="Before diesel and expenses" />
      </section>

      <section className="panel">
        <PanelHeader title="Trips" count={list.length} search={search} onSearch={setSearch} searchPlaceholder="Search place, trip no." onRefresh={reload} loading={loading}>
          <select className="input h-9 min-h-0 w-auto py-0 text-xs md:text-sm" value={paymentType} onChange={(event) => setPaymentType(event.target.value)} aria-label="Payment">
            <option value="">All payments</option>
            <option value="credit">Credit</option>
            <option value="partial">Partial</option>
            <option value="full">Paid</option>
          </select>
          <div className="w-48"><VehicleSelect vehicles={vehicles} value={vehicleId} onChange={setVehicleId} allowEmpty emptyLabel="All vehicles" includeSold /></div>
          <MonthFilter value={month} onChange={setMonth} />
        </PanelHeader>
        {loading && !list.length ? <Loading /> : list.length === 0 ? <EmptyState title="No trips this month" hint='Add one with "Add Trip".' /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>Vehicle</th>
                  <th className={TH}>Party</th>
                  <th className={TH}>Route</th>
                  <th className={TH}>Charge</th>
                  <th className={`${TH} text-right`}>Bill</th>
                  <th className={`${TH} text-right`}>Hire</th>
                  <th className={TH}>Status</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {list.map((trip) => (
                  <tr key={trip._id} className="tbl-row cursor-pointer" onClick={() => setEditing(trip)}>
                    <td className={TD}>
                      <p className="whitespace-nowrap font-semibold text-slate-800">{formatDate(trip.date)}</p>
                      <p className="font-mono text-[11px] text-slate-500">{trip.tripNo}</p>
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>
                      <p className="font-mono font-semibold">{trip.vehicleId?.vehicleNo || '—'}</p>
                      {trip.driverId?.name && <p className="text-xs text-slate-500">{trip.driverId.name}</p>}
                    </td>
                    <td className={TD}>{trip.partyId?.name || '—'}</td>
                    <td className={TD}>
                      <p>{[trip.from, trip.to].filter(Boolean).join(' → ') || '—'}</p>
                      {trip.material && <p className="text-xs text-slate-500">{trip.material}{trip.materialBy === 'me' && trip.materialAmount ? ` · supplied ${formatRupees(trip.materialAmount)}` : ''}</p>}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-xs`}>{describeCharge(trip.billingBasis, trip.quantity, trip.rate, trip.distanceKm)}</td>
                    <td className={`${TD} text-right`}>
                      <p className="font-semibold text-emerald-700">{formatRupees(trip.amount)}</p>
                      <p className="mt-0.5 whitespace-nowrap text-[11px]">
                        <span className={PAYMENT[trip.paymentType || 'credit'].className}>{PAYMENT[trip.paymentType || 'credit'].label}</span>
                        {trip.paymentType === 'partial' && <span className="ml-1 text-slate-500">due {formatRupees(trip.amount - trip.receivedAmount)}</span>}
                      </p>
                    </td>
                    <td className={`${TD} text-right text-amber-700`}>{trip.hireAmount ? formatRupees(trip.hireAmount) : '—'}</td>
                    <td className={TD}><span className={STATUS[trip.status]?.className}>{STATUS[trip.status]?.label}</span></td>
                    <td className={TD}>
                      <div className="flex justify-end">
                        <RowAction title="Edit" icon={Pencil} onClick={() => setEditing(trip)} />
                        <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => handleDelete(trip)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <TripPopup trip={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={reload} />}
    </Page>
  );
}
