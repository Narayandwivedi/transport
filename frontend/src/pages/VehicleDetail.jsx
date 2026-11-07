import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileBadge, Gauge, IndianRupee, Pencil, Plus, Route, TrendingUp, Wallet, Wrench } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { currentMonthInput, formatDate, formatMonth, formatNumber, formatRupees, monthBounds } from '../utils/format';
import { describeCharge, getBasisLabel, getBasisUnit, getCategoryLabel } from '../utils/constants';
import StatCard from '../components/StatCard';
import Segmented from '../components/Segmented';
import MonthFilter from '../components/MonthFilter';
import VehiclePopup from '../components/VehiclePopup';
import TripPopup from '../components/TripPopup';
import ExpensePopup from '../components/ExpensePopup';
import DocumentPopup from '../components/DocumentPopup';
import DocumentTable from '../components/DocumentTable';
import MaintenanceTable from '../components/MaintenanceTable';
import { DonePopup, ScheduleForm } from '../components/MaintenancePopups';
import { ReadingPopup } from './MeterReadings';
import { closingOf, formatMeter, meterUnitOf, openingOf, runOf } from '../utils/meter';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, TD, TH } from '../components/ui';

const TABS = [
  { key: 'trips', label: 'Trips', icon: Route },
  { key: 'expenses', label: 'Expenses', icon: Wallet },
  { key: 'documents', label: 'Documents', icon: FileBadge },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench },
  { key: 'meter', label: 'Meter', icon: Gauge },
];

// One profit line: label on the left, amount on the right
const Line = ({ label, value, tone = 'text-slate-800', bold = false }) => (
  <div className={`flex items-center justify-between py-1.5 text-sm ${bold ? 'border-t border-slate-200 pt-2.5 font-bold' : ''}`}>
    <span className="text-slate-600">{label}</span>
    <span className={`font-semibold ${tone}`}>{value}</span>
  </div>
);

export default function VehicleDetail() {
  const { id } = useParams();
  const [month, setMonth] = useState(currentMonthInput());
  const [tab, setTab] = useState('trips');
  const [popup, setPopup] = useState(null);
  const range = monthBounds(month);

  const { data: vehicle, error, reload: reloadVehicle } = useFetch(`/vehicles/${id}`);
  const { data: profit, reload: reloadProfit } = useFetch('/reports/profit', { month });
  // This vehicle's driver, as given on the Drivers page
  const { data: drivers } = useFetch('/payroll/employees', { role: 'driver' }, []);
  const driver = (drivers || []).find((row) => row.isActive && String(row.vehicleId?._id || row.vehicleId || '') === id);
  const { data: trips, reload: reloadTrips } = useFetch('/trips', { vehicleId: id, ...range }, []);
  const { data: expenses, reload: reloadExpenses } = useFetch('/expenses', { vehicleId: id, ...range }, []);
  const { data: contracts } = useFetch('/contracts', { vehicleId: id, month }, []);
  const { data: docs, reload: reloadDocs } = useFetch('/documents', { vehicleId: id }, []);
  const { data: tasks, reload: reloadTasks } = useFetch('/maintenance', { vehicleId: id }, []);
  const { data: readings, reload: reloadReadings } = useFetch('/meter-readings', { vehicleId: id }, []);

  const reloadAll = () => {
    reloadVehicle();
    reloadProfit();
    reloadTrips();
    reloadExpenses();
    reloadDocs();
    reloadTasks();
    reloadReadings();
  };

  if (error) return <Page><ErrorBox message={error} /></Page>;
  if (!vehicle) return <Page><Loading /></Page>;

  const row = (profit?.vehicles || []).find((item) => item.vehicleId === id) || {};
  const running = (contracts || []).filter((contract) => contract.monthAmount > 0 || contract.status === 'running');

  const remove = async (url, label) => {
    if (!window.confirm(`Delete this ${label}?`)) return;
    try {
      await apiClient.delete(url);
      toast.success('Deleted');
      reloadAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const addButton = {
    trips: { label: 'Add Trip', open: () => setPopup({ type: 'trip' }) },
    expenses: { label: 'Add Expense', open: () => setPopup({ type: 'expense' }) },
    documents: { label: 'Add Document', open: () => setPopup({ type: 'document', preset: { vehicleId: id } }) },
    maintenance: { label: 'Add Schedule', open: () => setPopup({ type: 'schedule' }) },
    meter: { label: 'Add Reading', open: () => setPopup({ type: 'reading' }) },
  }[tab];

  return (
    <Page>
      <PageHeader
        title={<span className="font-mono">{vehicle.vehicleNo}</span>}
        subtitle={[
          getCategoryLabel(vehicle.category),
          vehicle.ownership === 'own' ? 'My vehicle' : `Hired from ${vehicle.ownerPartyId?.name || '—'}${vehicle.hireBasis ? ` · ${getBasisLabel(vehicle.hireBasis)} @ ${formatRupees(vehicle.hireRate)}` : ''}`,
          driver && `Driver ${driver.name}${driver.mobile ? ` (${driver.mobile})` : ''}`,
        ].filter(Boolean).join(' · ')}
      >
        <MonthFilter value={month} onChange={setMonth} />
        <button type="button" className="btn-secondary" onClick={() => setPopup({ type: 'vehicle' })}><Pencil size={16} /> Edit</button>
      </PageHeader>

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={IndianRupee} tone="emerald" label="Income" value={formatRupees(row.income)} hint={`${row.trips || 0} trips + rent`} />
        <StatCard compact icon={Wallet} tone="rose" label="Cost" value={formatRupees(row.cost)} hint="Hire, rent and expenses" />
        <StatCard compact icon={TrendingUp} tone={(row.profit || 0) >= 0 ? 'blue' : 'rose'} label="Profit" value={formatRupees(row.profit)} hint={formatMonth(month)} />
        <StatCard compact icon={Gauge} tone="slate" label={meterUnitOf(vehicle) === 'hrs' ? 'Hour Meter' : 'Odometer'} value={formatMeter(vehicle.currentKm, vehicle)} hint={`${formatNumber(row.km, 0)} km on trips this month`} />
      </section>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <section className="card">
          <h2 className="mb-2 text-sm font-bold text-slate-800">Profit · {formatMonth(month)}</h2>
          <Line label="Trip billing" value={formatRupees(row.tripIncome)} tone="text-emerald-700" />
          <Line label="Monthly rent received" value={formatRupees(row.rentIncome)} tone="text-emerald-700" />
          <Line label="Hire paid on trips" value={`− ${formatRupees(row.tripHireCost)}`} tone="text-rose-700" />
          <Line label="Monthly rent paid" value={`− ${formatRupees(row.rentCost)}`} tone="text-rose-700" />
          <Line label="Expenses (diesel, tyres, repair…)" value={`− ${formatRupees(row.expenses)}`} tone="text-rose-700" />
          <Line label="Profit" value={formatRupees(row.profit)} tone={(row.profit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'} bold />
        </section>
        <section className="card">
          <h2 className="mb-2 text-sm font-bold text-slate-800">Monthly Hire</h2>
          {running.length === 0 ? <p className="text-sm text-slate-500">Not on monthly hire this month.</p> : (
            <div className="space-y-2">
              {running.map((contract) => (
                <div key={contract._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
                  <div>
                    <span className={contract.direction === 'hire_in' ? 'badge-orange' : 'badge-green'}>{contract.direction === 'hire_in' ? 'Hired from' : 'Given to'}</span>
                    <span className="ml-2 font-semibold">{contract.partyId?.name}</span>
                    <p className="text-xs text-slate-500">{formatRupees(contract.monthlyRate)}/month · {formatDate(contract.startDate)} → {contract.endDate ? formatDate(contract.endDate) : 'running'}</p>
                  </div>
                  <span className={`font-bold ${contract.direction === 'hire_in' ? 'text-rose-700' : 'text-emerald-700'}`}>{formatRupees(contract.monthAmount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {(vehicle.routeRates || []).length > 0 && (
        <section className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Route Rates</h2>
            <button type="button" className="text-xs font-semibold text-primary-600 hover:underline" onClick={() => setPopup({ type: 'vehicle' })}>Edit routes</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {vehicle.routeRates.map((route) => (
              <button
                key={`${route.from}-${route.to}`}
                type="button"
                title="Add a trip on this route"
                onClick={() => setPopup({ type: 'trip', preset: { from: route.from, to: route.to } })}
                className="rounded-lg bg-emerald-50 px-3 py-2 text-left text-xs ring-1 ring-emerald-200 transition hover:brightness-95"
              >
                <span className="block font-semibold text-slate-800">{route.from} → {route.to}</span>
                <span className="block font-bold text-emerald-700">
                  {formatRupees(route.rate)}/{getBasisUnit(route.basis || 'per_trip')}{vehicle.ownership === 'hired' && route.hireRate ? <span className="font-medium text-amber-700"> · owner {formatRupees(route.hireRate)}</span> : ''}
                  {route.distanceKm > 0 && <span className="font-medium text-slate-500"> · {formatNumber(route.distanceKm, 0)} km</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={tab} onChange={setTab} options={TABS} />
        <button type="button" className="btn-primary btn-sm" onClick={addButton.open}><Plus size={16} /> {addButton.label}</button>
      </div>

      <section className="panel">
        {tab === 'trips' && ((trips || []).length === 0 ? <EmptyState title="No trips this month" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead><tr><th className={TH}>Trip</th><th className={TH}>Party</th><th className={TH}>Route</th><th className={TH}>Charge</th><th className={`${TH} text-right`}>Bill</th><th className={`${TH} text-right`}>Hire</th></tr></thead>
              <tbody>
                {trips.map((trip) => (
                  <tr key={trip._id} className="tbl-row cursor-pointer" onClick={() => setPopup({ type: 'trip', record: trip })}>
                    <td className={TD}><p className="font-mono text-xs font-semibold">{trip.tripNo}</p><p className="text-xs text-slate-500">{formatDate(trip.date)}</p></td>
                    <td className={TD}>{trip.partyId?.name}</td>
                    <td className={TD}>{[trip.from, trip.to].filter(Boolean).join(' → ') || '—'}</td>
                    <td className={`${TD} text-xs`}>{describeCharge(trip.billingBasis, trip.quantity, trip.rate, trip.distanceKm)}</td>
                    <td className={`${TD} text-right font-semibold text-emerald-700`}>{formatRupees(trip.amount)}</td>
                    <td className={`${TD} text-right text-amber-700`}>{trip.hireAmount ? formatRupees(trip.hireAmount) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {tab === 'expenses' && ((expenses || []).length === 0 ? <EmptyState title="No expenses this month" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead><tr><th className={TH}>Date</th><th className={TH}>Type</th><th className={TH}>Notes</th><th className={`${TH} text-right`}>Amount</th><th className={TH} /></tr></thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense._id} className="tbl-row">
                    <td className={`${TD} whitespace-nowrap`}>{formatDate(expense.date)}</td>
                    <td className={`${TD} font-semibold`}>{expense.category}{expense.source === 'inventory' && <span className="badge-blue ml-1">Store</span>}{expense.source === 'payroll' && <span className="badge-green ml-1">Payroll</span>}</td>
                    <td className={TD}>{[expense.paidTo, expense.notes].filter(Boolean).join(' · ') || '—'}</td>
                    <td className={`${TD} text-right font-semibold text-rose-700`}>{formatRupees(expense.amount)}</td>
                    <td className={`${TD} text-right`}>
                      {!['inventory', 'payroll'].includes(expense.source) && (
                        <button type="button" className="icon-btn p-1.5" onClick={() => setPopup({ type: 'expense', record: expense })} aria-label="Edit"><Pencil size={16} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {tab === 'documents' && ((docs || []).length === 0 ? <EmptyState title="No documents stored" hint="Add road tax, insurance, fitness, PUC, GPS…" /> : (
          <DocumentTable
            docs={docs}
            showVehicle={false}
            onEdit={(doc) => setPopup({ type: 'document', record: doc })}
            onRenew={(doc) => setPopup({ type: 'document', preset: { vehicleId: id, docType: doc.docType, provider: doc.provider } })}
            onDelete={(doc) => remove(`/documents/${doc._id}`, 'document')}
          />
        ))}

        {tab === 'maintenance' && ((tasks || []).length === 0 ? <EmptyState title="No service schedules" /> : (
          <MaintenanceTable
            tasks={tasks}
            showVehicle={false}
            onDone={(task) => setPopup({ type: 'done', record: task })}
            onEdit={(task) => setPopup({ type: 'schedule', record: task })}
            onDelete={(task) => remove(`/maintenance/${task._id}`, 'schedule')}
          />
        ))}

        {tab === 'meter' && ((readings || []).length === 0 ? <EmptyState title="No readings yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left">
              <thead><tr><th className={TH}>Date</th><th className={`${TH} text-right`}>Opening</th><th className={`${TH} text-right`}>Closing</th><th className={`${TH} text-right`}>{meterUnitOf(vehicle) === 'hrs' ? 'Hours Run' : 'KM Run'}</th><th className={TH}>Notes</th></tr></thead>
              <tbody>
                {readings.map((reading) => (
                  <tr key={reading._id} className="tbl-row cursor-pointer" onClick={() => setPopup({ type: 'reading', record: reading })}>
                    <td className={TD}>{formatDate(reading.date)}</td>
                    <td className={`${TD} text-right`}>{openingOf(reading) !== null ? formatMeter(openingOf(reading), vehicle) : '—'}</td>
                    <td className={`${TD} text-right font-semibold`}>{closingOf(reading) !== null ? formatMeter(closingOf(reading), vehicle) : <span className="badge-orange">Pending</span>}</td>
                    <td className={`${TD} text-right font-semibold text-primary-700`}>{runOf(reading) !== null ? formatMeter(runOf(reading), vehicle) : '—'}</td>
                    <td className={TD}>{reading.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      {popup?.type === 'vehicle' && <VehiclePopup vehicle={vehicle} onClose={() => setPopup(null)} onSaved={reloadAll} />}
      {popup?.type === 'trip' && <TripPopup trip={popup.record} preset={{ vehicleId: id, ...(popup.preset || {}) }} onClose={() => setPopup(null)} onSaved={reloadAll} />}
      {popup?.type === 'expense' && <ExpensePopup expense={popup.record} preset={{ vehicleId: id }} onClose={() => setPopup(null)} onSaved={reloadAll} />}
      {popup?.type === 'document' && <DocumentPopup doc={popup.record} preset={popup.preset || {}} onClose={() => setPopup(null)} onSaved={reloadAll} />}
      {popup?.type === 'schedule' && <ScheduleForm task={popup.record} preset={{ vehicleId: id, lastDoneKm: vehicle.currentKm || '' }} onClose={() => setPopup(null)} onSaved={reloadAll} />}
      {popup?.type === 'done' && <DonePopup task={popup.record} onClose={() => setPopup(null)} onSaved={reloadAll} />}
      {popup?.type === 'reading' && <ReadingPopup reading={popup.record} preset={{ vehicleId: id }} onClose={() => setPopup(null)} onSaved={reloadAll} />}
    </Page>
  );
}
