import { useState } from 'react';
import { IndianRupee, Pencil, Plus, Route, Trash2, TrendingUp, Truck } from 'lucide-react';
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

export default function Trips() {
  const [month, setMonth] = useState(currentMonthInput());
  const [vehicleId, setVehicleId] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const { vehicles } = useMasters();
  const { data: trips, loading, error, reload } = useFetch('/trips', { ...monthBounds(month), vehicleId, search }, []);

  const list = trips || [];
  const billed = list.reduce((total, trip) => total + trip.amount, 0);
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

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Route} tone="indigo" label="Trips" value={list.length} hint={`${formatNumber(km, 0)} km run`} />
        <StatCard compact icon={IndianRupee} tone="emerald" label="Billed" value={formatRupees(billed)} />
        <StatCard compact icon={Truck} tone="amber" label="Hire Paid (trips)" value={formatRupees(hire)} hint="To owners of hired vehicles" />
        <StatCard compact icon={TrendingUp} tone="blue" label="Trip Margin" value={formatRupees(billed - hire)} hint="Before diesel and expenses" />
      </section>

      <section className="panel">
        <PanelHeader title="Trips" count={list.length} search={search} onSearch={setSearch} searchPlaceholder="Search place, trip no." onRefresh={reload} loading={loading}>
          <div className="w-48"><VehicleSelect vehicles={vehicles} value={vehicleId} onChange={setVehicleId} allowEmpty emptyLabel="All vehicles" includeSold /></div>
          <MonthFilter value={month} onChange={setMonth} />
        </PanelHeader>
        {loading && !list.length ? <Loading /> : list.length === 0 ? <EmptyState title="No trips this month" hint='Add one with "Add Trip".' /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Trip</th>
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
                      <p className="font-mono text-xs font-semibold text-slate-800">{trip.tripNo}</p>
                      <p className="whitespace-nowrap text-xs text-slate-500">{formatDate(trip.date)}</p>
                    </td>
                    <td className={`${TD} whitespace-nowrap font-mono font-semibold`}>{trip.vehicleId?.vehicleNo || '—'}</td>
                    <td className={TD}>{trip.partyId?.name || '—'}</td>
                    <td className={TD}>
                      <p>{[trip.from, trip.to].filter(Boolean).join(' → ') || '—'}</p>
                      {trip.material && <p className="text-xs text-slate-500">{trip.material}</p>}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-xs`}>{describeCharge(trip.billingBasis, trip.quantity, trip.rate, trip.distanceKm)}</td>
                    <td className={`${TD} text-right font-semibold text-emerald-700`}>{formatRupees(trip.amount)}</td>
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
