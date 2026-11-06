import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useMasters from '../utils/useMasters';
import { formatRupees, idOf, toDayInput, todayInput, toNumber } from '../utils/format';
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
  { value: 'credit', label: 'Credit (pay pump later)' },
];

// Litres to 2 places, money to 2 places, without trailing zeros
const trim = (value) => String(Math.round(value * 100) / 100);

/**
 * Diesel bought at a petrol pump straight into a vehicle. Saved as the vehicle's diesel expense;
 * on credit, the amount is owed to the pump and shows in its ledger.
 * Type the litres and rate (amount is worked out), or the amount and rate (litres are worked out).
 */
export default function DieselPopup({ entry = null, preset = {}, onClose, onSaved }) {
  const { vehicles, parties, reload: reloadParties } = useMasters();
  const [form, setForm] = useState(() => (entry ? {
    date: toDayInput(entry.date),
    vehicleId: idOf(entry.vehicleId),
    partyId: idOf(entry.partyId),
    litres: String(entry.litres || ''),
    rate: String(entry.rate || ''),
    amount: String(entry.amount || ''),
    meterReading: entry.meterReading ? String(entry.meterReading) : '',
    mode: entry.mode || 'cash',
    billNo: entry.billNo || '',
    notes: entry.notes || '',
  } : {
    date: todayInput(), vehicleId: '', partyId: '', litres: '', rate: '', amount: '', meterReading: '', mode: 'cash', billNo: '', notes: '', ...preset,
  }));
  const [addingPump, setAddingPump] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const vehicle = vehicles.find((item) => item._id === form.vehicleId);

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

  const handleSubmit = async () => {
    if (form.mode === 'credit' && !form.partyId) return toast.error('Pick the petrol pump to fill on credit');
    setSaving(true);
    try {
      const payload = { ...form };
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
            {form.mode === 'credit' && <span className="badge-orange ml-1.5">On credit</span>}
          </span>
        )}
      >
        <FormSection number={1} title="Vehicle & Pump" tone="blue">
          <FieldGrid cols={2}>
            <Field label="Date" required htmlFor="dsl-date">
              <input id="dsl-date" type="date" className="input" value={form.date} onChange={(event) => set('date', event.target.value)} required />
            </Field>
            <Field label="Vehicle" required hint={vehicle?.currentKm ? `Meter now: ${formatMeter(vehicle.currentKm, vehicle)}` : ''}>
              <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={(value) => set('vehicleId', value)} required />
            </Field>
            <Field label="Petrol Pump" action={<AddLink onClick={() => setAddingPump(true)}>New Pump</AddLink>}>
              <PartySelect parties={parties} value={form.partyId} onChange={(value) => set('partyId', value)} prefer={['pump']} allowEmpty emptyLabel="Not saved (paid on the spot)" />
            </Field>
            <Field label="Pump Bill / Slip No." htmlFor="dsl-bill">
              <input id="dsl-bill" className="input" value={form.billNo} onChange={(event) => set('billNo', event.target.value)} placeholder="Optional" />
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection number={2} title="Diesel" tone="amber" hint="Type litres and rate, or the amount and rate: the third is worked out.">
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
            <Field label="Paid By" required>
              <select className="input" value={form.mode} onChange={(event) => set('mode', event.target.value)}>
                {PAY_MODES.map((option) => <option key={option.value} value={option.value} disabled={option.value === 'credit' && !form.partyId}>{option.label}</option>)}
              </select>
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection number={3} title="Notes" tone="slate">
          <textarea rows={2} className="input resize-none" aria-label="Notes" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Optional" />
        </FormSection>
      </FormPopup>

      {addingPump && (
        <PartyPopup
          defaultType="pump"
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
