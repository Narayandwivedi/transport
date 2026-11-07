import { useState } from 'react';
import { Fuel, Gauge, Pencil, Plus, Timer, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import useMasters from '../utils/useMasters';
import { formatDate, formatNumber, idOf, toDayInput, todayInput } from '../utils/format';
import { closingOf, formatMeter, meterUnitOf, openingOf, runOf } from '../utils/meter';
import DieselPopup from '../components/DieselPopup';
import FormPopup from '../components/FormPopup';
import FormSection, { FieldGrid } from '../components/FormSection';
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
  const unit = meterUnitOf(vehicle);
  const fmt = (value) => formatMeter(value, vehicle);

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
      subtitle="Opening and closing of the meter (km or hours). Services due are checked against it."
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={saving}
      maxWidth="max-w-xl"
    >
      <FormSection number={1} title="Vehicle & Date" tone="blue">
      <FieldGrid cols={2}>
      <Field label="Vehicle" required>
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
      <Field label="Date" required htmlFor="mr-date">
        <input id="mr-date" type="date" className="input" value={form.date} onChange={(event) => set('date', event.target.value)} required />
      </Field>
      </FieldGrid>
      </FormSection>
      <FormSection number={2} title={unit === 'hrs' ? 'Hour Meter' : 'Odometer'} tone="sky">
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Field label="Opening" required>
          <MoneyInput
            prefix=""
            suffix={unit}
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
          <MoneyInput prefix="" suffix={unit} value={form.closingReading} onChange={(value) => set('closingReading', value)} placeholder="At day end" autoFocus={Boolean(preset.vehicleId) || Boolean(reading)} />
        </Field>
      </div>

      <div className="space-y-1 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600 ring-1 ring-sky-200">
        {previous ? (
          <p>
            Last entry {formatDate(previous.date)}:{' '}
            {previousClosing !== null
              ? <>closed at <span className="font-semibold text-slate-800">{fmt(previousClosing)}</span></>
              : <span className="font-semibold text-amber-700">no closing entered yet (opened at {fmt(openingOf(previous))})</span>}
          </p>
        ) : form.vehicleId ? (
          <p>First reading for this vehicle{vehicle?.currentKm ? `. Meter known so far: ${fmt(vehicle.currentKm)}` : ''}.</p>
        ) : (
          <p>Pick the vehicle to see its last closing.</p>
        )}
        {gap !== 0 && (
          <p className={`font-medium ${gap > 0 ? 'text-amber-700' : 'text-rose-700'}`}>
            {gap > 0
              ? `Opening is ${fmt(gap)} more than the last closing (${unit} not entered in between)`
              : `Opening is ${fmt(-gap)} less than the last closing. Check the number.`}
          </p>
        )}
        <p>
          {unit === 'hrs' ? 'Hours Run' : 'KM Run'}:{' '}
          <span className={`font-bold ${run !== null && run < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {run === null ? 'after closing is entered' : fmt(run)}
          </span>
        </p>
      </div>
      </FormSection>

      <FormSection number={3} title="Notes" tone="slate">
        <textarea id="mr-notes" rows={2} className="input resize-none" aria-label="Notes" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Optional" />
      </FormSection>
    </FormPopup>
  );
}

// Which entries the list shows
const SOURCES = [
  { value: '', label: 'All' },
  { value: 'reading', label: 'Meter Readings' },
  { value: 'diesel', label: 'At Diesel Fill' },
];

/**
 * Diesel fills that noted the meter at the pump, newest first, each with the run since the vehicle's
 * previous fill that noted the meter.
 */
const dieselMeterRows = (entries) => {
  const rows = (entries || []).filter((entry) => entry.meterReading > 0);
  const lastOf = {};
  const withRun = [...rows].sort(byOldest).map((entry) => {
    const vehicleId = idOf(entry.vehicleId);
    const before = lastOf[vehicleId];
    lastOf[vehicleId] = entry;
    return { ...entry, sinceLast: before ? entry.meterReading - before.meterReading : null };
  });
  return withRun.reverse();
};

export default function MeterReadings() {
  const [vehicleId, setVehicleId] = useState('');
  const [editing, setEditing] = useState(null);
  const { vehicles, reload: reloadVehicles } = useMasters();
  const [source, setSource] = useState('');
  const [editingDiesel, setEditingDiesel] = useState(null);
  const { data: readings, loading, error, reload } = useFetch('/meter-readings', { vehicleId }, []);
  const { data: dieselEntries, loading: dieselLoading, reload: reloadDiesel } = useFetch('/diesel-entries', { vehicleId }, []);
  const list = readings || [];
  const dieselRows = dieselMeterRows(dieselEntries);
  // Meter readings and diesel fills together, newest first
  const rows = [
    ...(source === 'diesel' ? [] : list.map((row) => ({ kind: 'reading', row }))),
    ...(source === 'reading' ? [] : dieselRows.map((row) => ({ kind: 'diesel', row }))),
  ].sort((a, b) => byOldest(b.row, a.row));
  const openEntries = list.filter((row) => closingOf(row) === null);
  const monthStart = todayInput().slice(0, 7);
  const runThisMonth = (unit) => list
    .filter((row) => toDayInput(row.date).startsWith(monthStart) && meterUnitOf(row.vehicleId) === unit)
    .reduce((total, row) => total + Math.max(0, runOf(row) || 0), 0);
  const kmThisMonth = runThisMonth('km');
  const hrsThisMonth = runThisMonth('hrs');
  const runText = [kmThisMonth || !hrsThisMonth ? formatMeter(kmThisMonth) : '', hrsThisMonth ? formatMeter(hrsThisMonth, { meterUnit: 'hrs' }) : ''].filter(Boolean).join(' · ');

  const refresh = () => {
    reload();
    reloadDiesel();
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
      <PageHeader title="Meter Reading" subtitle="Opening and closing meter (km or hours) of each vehicle, for running and service alerts">
        <button type="button" className="btn-primary" onClick={() => setEditing({})}><Plus size={18} /> Add Reading</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Gauge} tone="indigo" label="Run This Month" value={runText} hint={vehicleId ? 'This vehicle' : 'All vehicles'} />
        <StatCard compact icon={Fuel} tone="amber" label="At Diesel Fill" value={dieselRows.length} hint="Readings noted at the pump" />
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
              <span className="block text-base font-bold text-slate-900">{formatMeter(vehicle.currentKm, vehicle)}</span>
            </span>
          </button>
        ))}
      </section>

      <section className="panel">
        <PanelHeader title="Readings" count={rows.length} onRefresh={refresh} loading={loading || dieselLoading}>
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {SOURCES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSource(option.value)}
                aria-pressed={source === option.value}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${source === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="w-52"><VehicleSelect vehicles={vehicles} value={vehicleId} onChange={setVehicleId} allowEmpty emptyLabel="All vehicles" includeSold /></div>
        </PanelHeader>
        {(loading || dieselLoading) && !rows.length ? <Loading /> : rows.length === 0 ? (
          <EmptyState title={source === 'diesel' ? 'No meter noted at a diesel fill' : 'No readings yet'} hint={source === 'diesel' ? 'Enter the meter reading on a Diesel Purchase and it shows here.' : 'Use "Add Reading" or tap a vehicle above.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>Vehicle</th>
                  <th className={TH}>Taken At</th>
                  <th className={`${TH} text-right`}>Opening</th>
                  <th className={`${TH} text-right`}>Closing</th>
                  <th className={`${TH} text-right`}>Run</th>
                  <th className={TH}>Notes</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ kind, row: reading }) => {
                  if (kind === 'diesel') {
                    return (
                      <tr key={`dsl-${reading._id}`} className="tbl-row cursor-pointer bg-amber-50/40" onClick={() => setEditingDiesel(reading)}>
                        <td className={`${TD} whitespace-nowrap`}>{formatDate(reading.date)}</td>
                        <td className={`${TD} font-mono font-semibold`}>{reading.vehicleId?.vehicleNo}</td>
                        <td className={TD}>
                          <span className="badge-orange inline-flex items-center gap-1"><Fuel size={12} /> Diesel fill</span>
                          <p className="mt-0.5 font-mono text-[11px] text-slate-500">{reading.entryNo}</p>
                        </td>
                        <td className={`${TD} text-right font-semibold`} colSpan={2}>
                          <span className="mr-1 text-xs font-normal text-slate-500">At pump</span>{formatMeter(reading.meterReading, reading.vehicleId)}
                        </td>
                        <td className={`${TD} text-right font-semibold text-primary-700`}>
                          {reading.sinceLast !== null ? formatMeter(reading.sinceLast, reading.vehicleId) : '—'}
                          {reading.sinceLast !== null && <p className="text-[11px] font-normal text-slate-500">since last fill</p>}
                        </td>
                        <td className={TD}>
                          <p>{formatNumber(reading.litres)} ltr{reading.partyId?.name ? ` · ${reading.partyId.name}` : ''}</p>
                          <p className="text-xs text-slate-500">{reading.tripId ? `Trip ${reading.tripId.tripNo}` : 'No trip'}</p>
                        </td>
                        <td className={TD} onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end">
                            <RowAction title="Edit diesel entry" icon={Pencil} onClick={() => setEditingDiesel(reading)} />
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  const opening = openingOf(reading);
                  const closing = closingOf(reading);
                  const run = runOf(reading);
                  return (
                    <tr key={reading._id} className="tbl-row">
                      <td className={`${TD} whitespace-nowrap`}>{formatDate(reading.date)}</td>
                      <td className={`${TD} font-mono font-semibold`}>{reading.vehicleId?.vehicleNo}</td>
                      <td className={TD}><span className="badge-blue inline-flex items-center gap-1"><Gauge size={12} /> Meter reading</span></td>
                      <td className={`${TD} text-right`}>{opening !== null ? formatMeter(opening, reading.vehicleId) : '—'}</td>
                      <td className={`${TD} text-right font-semibold`}>
                        {closing !== null ? formatMeter(closing, reading.vehicleId) : (
                          <button type="button" className="badge-orange hover:brightness-95" onClick={() => setEditing(reading)}>Enter closing</button>
                        )}
                      </td>
                      <td className={`${TD} text-right font-semibold text-primary-700`}>{run !== null ? formatMeter(run, reading.vehicleId) : '—'}</td>
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
      {editingDiesel && <DieselPopup entry={editingDiesel} onClose={() => setEditingDiesel(null)} onSaved={refresh} />}
    </Page>
  );
}
