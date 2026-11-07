import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useMasters from '../utils/useMasters';
import { formatDate, formatRupees, idOf, toDayInput, todayInput, toNumber } from '../utils/format';
import { formatMeter, meterUnitOf } from '../utils/meter';
import FormPopup from './FormPopup';
import FormSection, { AddLink, FieldGrid } from './FormSection';
import PartyPopup from './PartyPopup';
import { PartySelect, VehicleSelect } from './Pickers';
import { Field, MoneyInput } from './ui';

const PAY_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank' },
];

// How many of the vehicle's latest trips the dropdown offers
const RECENT_TRIPS = 30;
// Shown after a trip that is not finished yet
const STATUS_TAG = { running: ' · Running', planned: ' · Planned' };

// Litres to 2 places, money to 2 places, without trailing zeros
const trim = (value) => String(Math.round(value * 100) / 100);

/**
 * Diesel bought at a petrol pump straight into a vehicle. Saved as the vehicle's diesel expense;
 * what is not paid now is owed to the pump and shows in its ledger (nothing paid = on credit).
 * Type the litres and rate (amount is worked out), or the amount and rate (litres are worked out).
 */
export default function DieselPopup({ entry = null, preset = {}, onClose, onSaved }) {
  const { vehicles, parties, reload: reloadParties } = useMasters();
  const [form, setForm] = useState(() => (entry ? {
    date: toDayInput(entry.date),
    vehicleId: idOf(entry.vehicleId),
    partyId: idOf(entry.partyId),
    tripId: idOf(entry.tripId),
    litres: String(entry.litres || ''),
    rate: String(entry.rate || ''),
    amount: String(entry.amount || ''),
    meterReading: entry.meterReading ? String(entry.meterReading) : '',
    // Entries saved before "paid now" existed: credit paid nothing, the rest were paid in full
    paidAmount: String(entry.paidAmount ?? (entry.mode === 'credit' ? 0 : entry.amount) ?? ''),
    mode: entry.mode && entry.mode !== 'credit' ? entry.mode : 'cash',
    billNo: entry.billNo || '',
    notes: entry.notes || '',
  } : {
    date: todayInput(), vehicleId: '', partyId: '', tripId: '', litres: '', rate: '', amount: '', meterReading: '', paidAmount: '', mode: 'cash', billNo: '', notes: '', ...preset,
  }));
  const [addingPump, setAddingPump] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const vehicle = vehicles.find((item) => item._id === form.vehicleId);

  // The vehicle's trips, newest first, tagged with the vehicle they were fetched for
  const [tripsOf, setTripsOf] = useState({ vehicleId: '', rows: [] });
  useEffect(() => {
    if (!form.vehicleId) return undefined;
    let live = true;
    apiClient.get('/trips', { params: { vehicleId: form.vehicleId } })
      .catch(() => [])
      .then((rows) => live && setTripsOf({ vehicleId: form.vehicleId, rows: Array.isArray(rows) ? rows : [] }));
    return () => { live = false; };
  }, [form.vehicleId]);
  const tripsLoading = Boolean(form.vehicleId) && tripsOf.vehicleId !== form.vehicleId;
  const allTrips = tripsLoading ? [] : tripsOf.rows;
  // Its latest few are offered, plus the one already linked if older
  const recentTrips = allTrips.slice(0, RECENT_TRIPS);
  const linkedTrip = allTrips.find((row) => row._id === form.tripId);
  const tripChoices = linkedTrip && !recentTrips.includes(linkedTrip) ? [...recentTrips, linkedTrip] : recentTrips;

  // A new fill on a vehicle with a running trip is taken as that trip's diesel; otherwise no trip until one is picked
  const autoPicked = useRef('');
  useEffect(() => {
    if (entry || tripsLoading || !form.vehicleId || autoPicked.current === form.vehicleId) return;
    autoPicked.current = form.vehicleId;
    const running = tripsOf.rows.find((row) => row.status === 'running');
    if (running) setForm((prev) => ({ ...prev, tripId: running._id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripsOf]);
  // Another vehicle's trip never stays linked
  const pickVehicle = (vehicleId) => setForm((prev) => ({ ...prev, vehicleId, tripId: vehicleId === prev.vehicleId ? prev.tripId : '' }));

  const changeLitres = (litres) => setForm((prev) => ({
    ...prev, litres, amount: toNumber(prev.rate) > 0 && toNumber(litres) > 0 ? trim(toNumber(litres) * toNumber(prev.rate)) : prev.amount,
  }));
  const changeRate = (rate) => setForm((prev) => {
    if (toNumber(prev.litres) > 0) return { ...prev, rate, amount: toNumber(rate) > 0 ? trim(toNumber(prev.litres) * toNumber(rate)) : prev.amount };
    if (toNumber(prev.amount) > 0 && toNumber(rate) > 0) return { ...prev, rate, litres: trim(toNumber(prev.amount) / toNumber(rate)) };
    return { ...prev, rate };
  });
  const changeAmount = (amount) => setForm((prev) => ({
    ...prev, amount, litres: toNumber(prev.rate) > 0 && toNumber(amount) > 0 ? trim(toNumber(amount) / toNumber(prev.rate)) : prev.litres,
  }));

  // Paid now: what was typed; without a saved pump it is all paid on the spot
  const total = toNumber(form.amount);
  const hasPump = Boolean(form.partyId);
  const paid = hasPump ? toNumber(form.paidAmount) : total;
  const balanceDue = Math.max(0, total - paid);
  let paymentLabel = 'On credit';
  if (paid > 0) paymentLabel = paid >= total ? 'Fully paid' : 'Part paid';

  const handleSubmit = async () => {
    if (paid > total) return toast.error('Paid cannot be more than the amount');
    setSaving(true);
    try {
      const payload = { ...form, paidAmount: paid };
      if (entry) await apiClient.put(`/diesel-entries/${entry._id}`, payload);
      else await apiClient.post('/diesel-entries', payload);
      toast.success(entry ? 'Diesel entry updated' : 'Diesel purchase saved');
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
    <>
      <FormPopup
        title={entry ? `Edit Diesel Purchase ${entry.entryNo}` : 'Diesel Purchase'}
        subtitle="Diesel filled at a petrol pump straight into a vehicle. Booked as the vehicle's diesel cost."
        maxWidth="max-w-2xl"
        onClose={onClose}
        onSubmit={handleSubmit}
        submitDisabled={saving}
        footerExtra={toNumber(form.amount) > 0 && (
          <span className="text-slate-600">
            Amount <b className="text-slate-900">{formatRupees(form.amount)}</b>
            {balanceDue > 0 && <span className="badge-orange ml-1.5">Due {formatRupees(balanceDue)}</span>}
          </span>
        )}
      >
        <FormSection number={1} title="Vehicle & Pump" tone="blue">
          <FieldGrid cols={2}>
            <Field label="Date" required htmlFor="dsl-date">
              <input id="dsl-date" type="date" className="input" value={form.date} onChange={(event) => set('date', event.target.value)} required />
            </Field>
            <Field label="Vehicle" required hint={vehicle?.currentKm ? `Meter now: ${formatMeter(vehicle.currentKm, vehicle)}` : ''}>
              <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={pickVehicle} required />
            </Field>
            <Field label="Petrol Pump" action={<AddLink onClick={() => setAddingPump(true)}>New Pump</AddLink>}>
              <PartySelect parties={parties} value={form.partyId} onChange={(value) => set('partyId', value)} prefer={['supplier']} allowEmpty emptyLabel="Not saved (paid on the spot)" />
            </Field>
            <Field label="Pump Bill / Slip No." htmlFor="dsl-bill">
              <input id="dsl-bill" className="input" value={form.billNo} onChange={(event) => set('billNo', event.target.value)} placeholder="Optional" />
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection number={2} title="For Trip" tone="sky" hint="Which trip this diesel was filled for. Pick No Trip when the vehicle is not on one.">
          <Field label="Trip" htmlFor="dsl-trip" hint={tripsLoading ? 'Loading trips…' : form.vehicleId && !allTrips.length ? 'No trips for this vehicle yet' : ''}>
            <select id="dsl-trip" className="input" value={form.tripId} onChange={(event) => set('tripId', event.target.value)} disabled={!form.vehicleId}>
              <option value="">{form.vehicleId ? 'No Trip (filled without a trip)' : 'Pick the vehicle first'}</option>
              {tripChoices.map((trip) => (
                <option key={trip._id} value={trip._id}>
                  {trip.tripNo} · {formatDate(trip.date)} · {trip.from || '—'} → {trip.to || '—'}{trip.partyId?.name ? ` · ${trip.partyId.name}` : ''}{STATUS_TAG[trip.status] || ''}
                </option>
              ))}
            </select>
          </Field>
        </FormSection>

        <FormSection number={3} title="Diesel" tone="amber" hint="Type litres and rate, or the amount and rate: the third is worked out.">
          <FieldGrid cols={3}>
            <Field label="Litres" required>
              <MoneyInput prefix="" suffix="ltr" value={form.litres} onChange={changeLitres} placeholder="0" required autoFocus={Boolean(preset.vehicleId)} />
            </Field>
            <Field label="Rate" required>
              <MoneyInput value={form.rate} onChange={changeRate} suffix="/ltr" placeholder="0.00" required />
            </Field>
            <Field label="Amount">
              <MoneyInput value={form.amount} onChange={changeAmount} placeholder="0" />
            </Field>
          </FieldGrid>
          <FieldGrid cols={2}>
            <Field label="Meter Reading" hint="At the pump. Optional, updates the vehicle's meter.">
              <MoneyInput prefix="" suffix={meterUnitOf(vehicle)} value={form.meterReading} onChange={(value) => set('meterReading', value)} />
            </Field>
          </FieldGrid>
        </FormSection>

        {/* Total, then what is paid now; nothing paid = on credit at the pump */}
        <FormSection number={4} title="Payment" tone="indigo" hint={hasPump ? "What is not paid now stays due in the pump's ledger." : 'No pump picked: paid in full on the spot. Pick the pump to fill on credit.'}>
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 ${paid > 0 ? 'md:grid-cols-3' : ''}`}>
            <Field label="Total Amount">
              <div className="input flex items-center bg-slate-50 font-bold text-slate-900">{formatRupees(total)}</div>
            </Field>
            <Field label="Paid Now" htmlFor="dsl-paid" action={hasPump && total > 0 && <AddLink onClick={() => set('paidAmount', String(total))}>Full amount</AddLink>}>
              {hasPump ? (
                <MoneyInput id="dsl-paid" value={form.paidAmount} onChange={(value) => set('paidAmount', value)} placeholder="0 (credit)" />
              ) : (
                <div className="input flex items-center bg-slate-50 font-semibold text-slate-700">{formatRupees(total)}</div>
              )}
            </Field>
            {/* How it was paid only matters when something was paid */}
            {paid > 0 && (
              <Field label="Paid By" htmlFor="dsl-mode">
                <select id="dsl-mode" className="input" value={form.mode} onChange={(event) => set('mode', event.target.value)}>
                  {PAY_MODES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
            )}
          </div>
          <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl px-4 py-2.5 ring-1 ${balanceDue > 0 ? 'bg-amber-50 ring-amber-200' : 'bg-emerald-50 ring-emerald-200'}`}>
            <span className={`text-sm font-semibold ${balanceDue > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
              {paymentLabel}
              {paid > total && <span className="ml-2 text-rose-700">more than the amount</span>}
            </span>
            <span className={`text-sm font-semibold ${balanceDue > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
              Due to pump: <span className="text-lg font-bold">{formatRupees(balanceDue)}</span>
            </span>
          </div>
        </FormSection>

        <FormSection number={5} title="Notes" tone="slate">
          <textarea rows={2} className="input resize-none" aria-label="Notes" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Optional" />
        </FormSection>
      </FormPopup>

      {addingPump && (
        <PartyPopup
          defaultType="supplier"
          onClose={() => setAddingPump(false)}
          onSaved={async (party) => {
            await reloadParties();
            set('partyId', party._id);
          }}
        />
      )}
    </>
  );
}

