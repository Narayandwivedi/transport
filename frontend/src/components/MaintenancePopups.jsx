import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useMasters from '../utils/useMasters';
import { MAINTENANCE_PRESETS } from '../utils/constants';
import { formatNumber, idOf, toDayInput, todayInput } from '../utils/format';
import FormPopup from './FormPopup';
import FormSection from './FormSection';
import { VehicleSelect } from './Pickers';
import { Field, MoneyInput } from './ui';

/**
 * A service that repeats: due every N km and/or every N days after it was last done.
 * Whichever comes first raises the alert.
 */
export function ScheduleForm({ task = null, preset = {}, onClose, onSaved }) {
  const { vehicles } = useMasters();
  const [form, setForm] = useState(() => (task ? {
    ...task,
    vehicleId: idOf(task.vehicleId),
    lastDoneDate: toDayInput(task.lastDoneDate),
    intervalKm: task.intervalKm || '',
    intervalDays: task.intervalDays || '',
    lastDoneKm: task.lastDoneKm || '',
  } : {
    vehicleId: '', title: '', intervalKm: '', intervalDays: '', lastDoneKm: '', lastDoneDate: todayInput(), alertBeforeKm: 500, alertBeforeDays: 7, notes: '', ...preset,
  }));
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const vehicle = vehicles.find((item) => item._id === form.vehicleId);

  const pickVehicle = (vehicleId) => {
    const picked = vehicles.find((item) => item._id === vehicleId);
    setForm((prev) => ({ ...prev, vehicleId, lastDoneKm: prev.lastDoneKm || (picked?.currentKm ? String(picked.currentKm) : '') }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        vehicleId: form.vehicleId, title: form.title, intervalKm: form.intervalKm || 0, intervalDays: form.intervalDays || 0,
        lastDoneKm: form.lastDoneKm || 0, lastDoneDate: form.lastDoneDate, alertBeforeKm: form.alertBeforeKm || 0, alertBeforeDays: form.alertBeforeDays || 0, notes: form.notes,
      };
      if (task) await apiClient.put(`/maintenance/${task._id}`, payload);
      else await apiClient.post('/maintenance', payload);
      toast.success('Service schedule saved');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPopup title={task ? 'Edit Service Schedule' : 'Add Service Schedule'} subtitle="Get an alert when km or days run out" maxWidth="max-w-xl" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving}>
      <FormSection number={1} title="Service" tone="blue">
        <Field label="Vehicle" hint={vehicle ? `Meter now: ${formatNumber(vehicle.currentKm, 0)} km` : ''}>
          <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={pickVehicle} required />
        </Field>
        <Field label="Service Name" htmlFor="mt-title">
          <input id="mt-title" className="input" value={form.title} onChange={(event) => set('title', event.target.value)} placeholder="Engine oil change" required />
          {!task && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MAINTENANCE_PRESETS.map((presetRow) => (
                <button
                  key={presetRow.title}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, title: presetRow.title, intervalKm: presetRow.intervalKm || '', intervalDays: presetRow.intervalDays || '' }))}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition ${form.title === presetRow.title ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'}`}
                >
                  {presetRow.title}
                </button>
              ))}
            </div>
          )}
        </Field>
      </FormSection>
      <FormSection number={2} title="Due Every" tone="amber" hint="Fill one or both. Empty = not checked.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Every">
            <MoneyInput prefix="" suffix="km" value={form.intervalKm} onChange={(value) => set('intervalKm', value)} />
          </Field>
          <Field label="Or every">
            <MoneyInput prefix="" suffix="days" value={form.intervalDays} onChange={(value) => set('intervalDays', value)} />
          </Field>
          <Field label="Last done at">
            <MoneyInput prefix="" suffix="km" value={form.lastDoneKm} onChange={(value) => set('lastDoneKm', value)} />
          </Field>
          <Field label="Last done on" htmlFor="mt-last">
            <input id="mt-last" type="date" className="input" value={form.lastDoneDate} onChange={(event) => set('lastDoneDate', event.target.value)} />
          </Field>
          <Field label="Warn before">
            <MoneyInput prefix="" suffix="km" value={form.alertBeforeKm} onChange={(value) => set('alertBeforeKm', value)} />
          </Field>
          <Field label="Warn before">
            <MoneyInput prefix="" suffix="days" value={form.alertBeforeDays} onChange={(value) => set('alertBeforeDays', value)} />
          </Field>
        </div>
      </FormSection>
      <Field label="Notes" htmlFor="mt-notes">
        <input id="mt-notes" className="input" value={form.notes} onChange={(event) => set('notes', event.target.value)} />
      </Field>
    </FormPopup>
  );
}

// Service done: restart the count, and book the bill as the vehicle's expense
export function DonePopup({ task, onClose, onSaved }) {
  const [form, setForm] = useState({ date: todayInput(), km: task.currentKm ? String(task.currentKm) : '', cost: '', paidTo: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await apiClient.post(`/maintenance/${task._id}/done`, form);
      toast.success('Service marked done');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPopup title="Mark Service Done" subtitle={`${task.title} · ${task.vehicleId?.vehicleNo || ''}`} submitLabel="Done" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="done-date">
          <input id="done-date" type="date" className="input" value={form.date} onChange={(event) => set('date', event.target.value)} required />
        </Field>
        <Field label="Odometer">
          <MoneyInput prefix="" suffix="km" value={form.km} onChange={(value) => set('km', value)} />
        </Field>
        <Field label="Cost" hint="Added to the vehicle's expenses">
          <MoneyInput value={form.cost} onChange={(value) => set('cost', value)} />
        </Field>
        <Field label="Garage" htmlFor="done-garage">
          <input id="done-garage" className="input" value={form.paidTo} onChange={(event) => set('paidTo', event.target.value)} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="done-notes">
        <input id="done-notes" className="input" value={form.notes} onChange={(event) => set('notes', event.target.value)} />
      </Field>
    </FormPopup>
  );
}
