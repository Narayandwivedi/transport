import { useState } from 'react';
import { Gauge, Pencil, Plus, Timer, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import useMasters from '../utils/useMasters';
import { formatDate, formatNumber, idOf, toDayInput, todayInput } from '../utils/format';
import { closingOf, openingOf, runOf } from '../utils/meter';
import FormPopup from '../components/FormPopup';
import StatCard from '../components/StatCard';
import { VehicleSelect } from '../components/Pickers';
import { EmptyState, ErrorBox, Field, Loading, MoneyInput, Page, PageHeader, PanelHeader, RowAction, TD, TH } from '../components/ui';

// Oldest first; same-day entries in the order they were made
const byOldest = (a, b) => toDayInput(a.date).localeCompare(toDayInput(b.date)) || new Date(a.createdAt) - new Date(b.createdAt);

/**
 * One run of a vehicle: odometer at the start and at the end.
 * The opening is filled from the vehicle's last closing (or its odometer) until a different one is typed.
 * The closing can be left empty while the vehicle is out, and filled in later.
 */
export function ReadingPopup({ reading = null, preset = {}, onClose, onSaved }) {
  const { vehicles } = useMasters();
  const [form, setForm] = useState(() => (reading ? {
    vehicleId: idOf(reading.vehicleId),
    date: toDayInput(reading.date),
    openingReading: openingOf(reading) ?? '',
    closingReading: closingOf(reading) ?? '',
    notes: reading.notes || '',
  } : { date: todayInput(), vehicleId: '', openingReading: '', closingReading: '', notes: '', ...preset }));
  const [openingTouched, setOpeningTouched] = useState(Boolean(reading));
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const { data: vehicleReadings } = useFetch(form.vehicleId ? '/meter-readings' : '', { vehicleId: form.vehicleId }, []);
  const vehicle = vehicles.find((item) => item._id === form.vehicleId);

  // The last entry of this vehicle on or before the chosen date (this entry itself left out)
  const previous = (vehicleReadings || [])
    .filter((row) => row._id !== reading?._id && toDayInput(row.date) <= form.date)
    .sort(byOldest)
    .at(-1) || null;
  const previousClosing = previous ? closingOf(previous) : null;
  const suggestedOpening = previousClosing ?? (vehicle?.currentKm ? vehicle.currentKm : '');
  const opening = openingTouched ? form.openingReading : String(suggestedOpening);

  const openingNum = opening === '' ? null : Number(opening);
  const closingNum = form.closingReading === '' ? null : Number(form.closingReading);
  const run = openingNum !== null && closingNum !== null ? closingNum - openingNum : null;
  const gap = previousClosing !== null && openingNum !== null ? openingNum - previousClosing : 0;

  const handleSubmit = async () => {
    if (openingNum === null) return toast.error('Enter the opening reading');
    if (closingNum !== null && closingNum < openingNum) return toast.error('Closing cannot be less than opening');
    setSaving(true);
    try {
      const payload = { date: form.date, vehicleId: form.vehicleId, openingReading: openingNum, closingReading: closingNum, notes: form.notes };
      if (reading) await apiClient.put(`/meter-readings/${reading._id}`, payload);
      else await apiClient.post('/meter-readings', payload);
      toast.success(reading ? 'Reading updated' : 'Reading saved');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <FormPopup
      title={reading ? 'Edit Meter Reading' : 'Add Meter Reading'}
      subtitle="Opening and closing of the odometer. Services due by km are checked against it."
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={saving}
    >
      <Field label="Vehicle">
        <VehicleSelect
          vehicles={vehicles}
          value={form.vehicleId}
          onChange={(value) => {
            set('vehicleId', value);
            if (!reading) setOpeningTouched(false);
          }}
          required
        />
      </Field>
      <Field label="Date" htmlFor="mr-date">
        <input id="mr-date" type="date" className="input" value={form.date} onChange={(event) => set('date', event.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Opening">
          <MoneyInput
            prefix=""
            suffix="km"
            value={opening}
            onChange={(value) => {
              setOpeningTouched(true);
              set('openingReading', value);
            }}
            placeholder="Meter at start"
            required
          />
        </Field>
        <Field label="Closing">
          <MoneyInput prefix="" suffix="km" value={form.closingReading} onChange={(value) => set('closingReading', value)} placeholder="At day end" autoFocus={Boolean(preset.vehicleId) || Boolean(reading)} />
        </Field>
      </div>

      <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
        {previous ? (
          <p>
            Last entry {formatDate(previous.date)}:{' '}
            {previousClosing !== null
              ? <>closed at <span className="font-semibold text-slate-800">{formatNumber(previousClosing, 0)} km</span></>
              : <span className="font-semibold text-amber-700">no closing entered yet (opened at {formatNumber(openingOf(previous), 0)} km)</span>}
          </p>
        ) : form.vehicleId ? (
          <p>First reading for this vehicle{vehicle?.currentKm ? `. Odometer known so far: ${formatNumber(vehicle.currentKm, 0)} km` : ''}.</p>
        ) : (
          <p>Pick the vehicle to see its last closing.</p>
        )}
        {gap !== 0 && (
          <p className={`font-medium ${gap > 0 ? 'text-amber-700' : 'text-rose-700'}`}>
            {gap > 0
              ? `Opening is ${formatNumber(gap, 0)} km more than the last closing (km not entered in between)`
              : `Opening is ${formatNumber(-gap, 0)} km less than the last closing. Check the number.`}
          </p>
        )}
        <p>
          KM Run:{' '}
          <span className={`font-bold ${run !== null && run < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {run === null ? 'after closing is entered' : `${formatNumber(run, 0)} km`}
          </span>
        </p>
      </div>

      <Field label="Notes" htmlFor="mr-notes">
        <input id="mr-notes" className="input" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Optional" />
      </Field>
    </FormPopup>
  );
}

export default function MeterReadings() {
  const [vehicleId, setVehicleId] = useState('');
  const [editing, setEditing] = useState(null);
  const { vehicles, reload: reloadVehicles } = useMasters();
  const { data: readings, loading, error, reload } = useFetch('/meter-readings', { vehicleId }, []);
  const list = readings || [];
  const openEntries = list.filter((row) => closingOf(row) === null);
  const monthStart = todayInput().slice(0, 7);
  const kmThisMonth = list.filter((row) => toDayInput(row.date).startsWith(monthStart)).reduce((total, row) => total + Math.max(0, runOf(row) || 0), 0);

  const refresh = () => {
    reload();
    reloadVehicles();
  };

  const handleDelete = async (reading) => {
    if (!window.confirm('Delete this reading?')) return;
    try {
      await apiClient.delete(`/meter-readings/${reading._id}`);
      toast.success('Reading deleted');
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Page>
      <PageHeader title="Meter Reading" subtitle="Opening and closing odometer of each vehicle, for km run and service alerts">
        <button type="button" className="btn-primary" onClick={() => setEditing({})}><Plus size={18} /> Add Reading</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Gauge} tone="indigo" label="KM Run This Month" value={`${formatNumber(kmThisMonth, 0)} km`} hint={vehicleId ? 'This vehicle' : 'All vehicles'} />
        <StatCard compact icon={Timer} tone={openEntries.length ? 'amber' : 'slate'} label="Closing Pending" value={openEntries.length} hint="Opened, not closed yet" />
      </section>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 xl:grid-cols-5">
        {vehicles.filter((vehicle) => vehicle.status !== 'sold').map((vehicle) => (
          <button
            key={vehicle._id}
            type="button"
            onClick={() => setEditing({ preset: { vehicleId: vehicle._id } })}
            className="card flex items-center gap-3 p-3 text-left transition hover:ring-primary-300 md:p-3"
            title="Add a reading"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"><Gauge size={18} /></span>
            <span className="min-w-0">
              <span className="block truncate font-mono text-xs font-semibold text-slate-700">{vehicle.vehicleNo}</span>
              <span className="block text-base font-bold text-slate-900">{formatNumber(vehicle.currentKm, 0)} km</span>
            </span>
          </button>
        ))}
      </section>

      <section className="panel">
        <PanelHeader title="Readings" count={list.length} onRefresh={refresh} loading={loading}>
          <div className="w-52"><VehicleSelect vehicles={vehicles} value={vehicleId} onChange={setVehicleId} allowEmpty emptyLabel="All vehicles" includeSold /></div>
        </PanelHeader>
        {loading && !list.length ? <Loading /> : list.length === 0 ? <EmptyState title="No readings yet" hint='Use "Add Reading" or tap a vehicle above.' /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>Vehicle</th>
                  <th className={`${TH} text-right`}>Opening</th>
                  <th className={`${TH} text-right`}>Closing</th>
                  <th className={`${TH} text-right`}>KM Run</th>
                  <th className={TH}>Notes</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {list.map((reading) => {
                  const opening = openingOf(reading);
                  const closing = closingOf(reading);
                  const run = runOf(reading);
                  return (
                    <tr key={reading._id} className="tbl-row">
                      <td className={`${TD} whitespace-nowrap`}>{formatDate(reading.date)}</td>
                      <td className={`${TD} font-mono font-semibold`}>{reading.vehicleId?.vehicleNo}</td>
                      <td className={`${TD} text-right`}>{opening !== null ? `${formatNumber(opening, 0)} km` : '—'}</td>
                      <td className={`${TD} text-right font-semibold`}>
                        {closing !== null ? `${formatNumber(closing, 0)} km` : (
                          <button type="button" className="badge-orange hover:brightness-95" onClick={() => setEditing(reading)}>Enter closing</button>
                        )}
                      </td>
                      <td className={`${TD} text-right font-semibold text-primary-700`}>{run !== null ? `${formatNumber(run, 0)} km` : '—'}</td>
                      <td className={TD}>{reading.notes || '—'}</td>
                      <td className={TD}>
                        <div className="flex justify-end">
                          <RowAction title="Edit" icon={Pencil} onClick={() => setEditing(reading)} />
                          <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => handleDelete(reading)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <ReadingPopup
          reading={editing._id ? editing : null}
          preset={editing.preset || {}}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </Page>
  );
}
