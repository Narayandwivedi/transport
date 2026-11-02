import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../../utils/api';
import useMasters from '../../utils/useMasters';
import { PAYMENT_MODE_OPTIONS } from '../../utils/constants';
import { formatMonth, formatRupees, idOf, toDayInput, todayInput } from '../../utils/format';
import { ENTRY_TYPES, getRoleLabel } from '../../utils/payroll';
import FormPopup from '../FormPopup';
import { VehicleSelect } from '../Pickers';
import { Field, MoneyInput } from '../ui';

/**
 * Pay salary, give an advance or bata, or add a bonus / deduction for an employee.
 * "Salary month" is the month it counts against: salary for September is often paid in early October.
 */
export default function EntryPopup({ entry = null, employees, month, preset = {}, balances = {}, onClose, onSaved }) {
  const { vehicles } = useMasters();
  const [form, setForm] = useState(() => {
    if (entry) {
      return { ...entry, employeeId: idOf(entry.employeeId), vehicleId: idOf(entry.vehicleId), date: toDayInput(entry.date) };
    }
    const employee = employees.find((item) => item._id === preset.employeeId);
    const type = preset.type || 'salary';
    return {
      employeeId: '', date: todayInput(), month, type, mode: 'cash', notes: '',
      ...preset,
      vehicleId: idOf(employee?.vehicleId),
      amount: type === 'salary' && balances[preset.employeeId] > 0 ? String(balances[preset.employeeId]) : '',
    };
  });
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const type = ENTRY_TYPES[form.type];

  const pickEmployee = (employeeId) => {
    const employee = employees.find((item) => item._id === employeeId);
    setForm((prev) => ({
      ...prev,
      employeeId,
      vehicleId: idOf(employee?.vehicleId),
      amount: prev.type === 'salary' && !prev.amount && balances[employeeId] > 0 ? String(balances[employeeId]) : prev.amount,
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = { employeeId: form.employeeId, date: form.date, month: form.month, type: form.type, amount: form.amount, mode: form.mode, vehicleId: form.vehicleId, notes: form.notes };
      if (entry) await apiClient.put(`/payroll/entries/${entry._id}`, payload);
      else await apiClient.post('/payroll/entries', payload);
      toast.success(`${type.label} saved`);
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const owed = balances[form.employeeId];

  return (
    <FormPopup title={entry ? 'Edit Entry' : type.label} subtitle={type.hint} onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving} maxWidth="max-w-lg">
      {!entry && (
        <div className="grid grid-cols-3 gap-1.5 md:grid-cols-5">
          {Object.entries(ENTRY_TYPES).map(([key, option]) => (
            <button
              key={key}
              type="button"
              onClick={() => set('type', key)}
              className={`rounded-lg border-2 px-2 py-1.5 text-xs font-semibold transition ${form.type === key ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
              {option.short}
            </button>
          ))}
        </div>
      )}
      <Field label="Employee" hint={owed !== undefined ? (owed >= 0 ? `Salary owed till now: ${formatRupees(owed)}` : `Advance outstanding: ${formatRupees(-owed)}`) : ''}>
        <select className="input" value={form.employeeId} onChange={(event) => pickEmployee(event.target.value)} required>
          <option value="" disabled>Select employee</option>
          {employees.filter((employee) => employee.isActive || employee._id === form.employeeId).map((employee) => (
            <option key={employee._id} value={employee._id}>{employee.name} · {getRoleLabel(employee.role)}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <MoneyInput value={form.amount} onChange={(value) => set('amount', value)} required />
        </Field>
        <Field label="Date" htmlFor="pe-date">
          <input id="pe-date" type="date" className="input" value={form.date} onChange={(event) => set('date', event.target.value)} required />
        </Field>
        <Field label="Salary Month" hint={formatMonth(form.month)}>
          <input type="month" className="input" value={form.month} onChange={(event) => event.target.value && set('month', event.target.value)} required />
        </Field>
        {type.paid ? (
          <Field label="Paid By">
            <select className="input" value={form.mode} onChange={(event) => set('mode', event.target.value)}>
              {PAYMENT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        ) : <span />}
      </div>
      {type.paid && (
        <Field label="Book Expense To" hint="Counts in this vehicle's profit">
          <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={(value) => set('vehicleId', value)} allowEmpty emptyLabel="No vehicle (general expense)" includeSold />
        </Field>
      )}
      <Field label="Notes" htmlFor="pe-notes">
        <input id="pe-notes" className="input" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder={form.type === 'deduction' ? 'e.g. challan, diesel short' : ''} />
      </Field>
    </FormPopup>
  );
}
