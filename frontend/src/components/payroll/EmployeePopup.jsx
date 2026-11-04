import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../../utils/api';
import useMasters from '../../utils/useMasters';
import { idOf, toDayInput, todayInput } from '../../utils/format';
import { ROLE_OPTIONS, SALARY_TYPES } from '../../utils/payroll';
import FormPopup from '../FormPopup';
import FormSection from '../FormSection';
import { VehicleSelect } from '../Pickers';
import { Field, MoneyInput } from '../ui';

const EMPTY = {
  name: '', mobile: '', role: 'driver', vehicleId: '', salaryType: 'monthly', rate: '', joinDate: todayInput(),
  licenseNo: '', licenseExpiry: '', openingBalance: '', balanceSide: 'owed', address: '', notes: '',
};

export default function EmployeePopup({ employee = null, defaultRole = 'driver', defaultVehicleId = '', onClose, onSaved }) {
  const { vehicles } = useMasters();
  const [form, setForm] = useState(() => (employee ? {
    ...EMPTY,
    ...employee,
    vehicleId: idOf(employee.vehicleId),
    joinDate: toDayInput(employee.joinDate),
    licenseExpiry: toDayInput(employee.licenseExpiry),
    openingBalance: employee.openingBalance ? Math.abs(employee.openingBalance) : '',
    balanceSide: employee.openingBalance < 0 ? 'advance' : 'owed',
  } : { ...EMPTY, role: defaultRole, vehicleId: defaultVehicleId }));
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    const opening = Number(form.openingBalance || 0);
    const payload = {
      name: form.name, mobile: form.mobile, role: form.role, vehicleId: form.vehicleId, salaryType: form.salaryType, rate: form.rate,
      joinDate: form.joinDate, licenseNo: form.licenseNo, licenseExpiry: form.licenseExpiry, address: form.address, notes: form.notes,
      openingBalance: form.balanceSide === 'advance' ? -opening : opening,
    };
    try {
      const saved = employee
        ? await apiClient.put(`/payroll/employees/${employee._id}`, payload)
        : await apiClient.post('/payroll/employees', payload);
      const what = form.role === 'driver' ? 'Driver' : 'Employee';
      toast.success(employee ? `${what} updated` : `${what} added`);
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPopup title={`${employee ? 'Edit' : 'Add'} ${form.role === 'driver' ? 'Driver' : 'Employee'}`} subtitle="Driver, helper, mechanic or office staff" maxWidth="max-w-2xl" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving}>
      <FormSection number={1} title="Employee" tone="blue">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          <Field label="Name" required htmlFor="emp-name">
            <input id="emp-name" className="input" value={form.name} onChange={(event) => set('name', event.target.value)} required autoFocus />
          </Field>
          <Field label="Mobile" htmlFor="emp-mobile">
            <input id="emp-mobile" className="input" value={form.mobile} onChange={(event) => set('mobile', event.target.value)} inputMode="tel" />
          </Field>
          <Field label="Work" className="col-span-2 md:col-span-1">
            <select className="input" value={form.role} onChange={(event) => set('role', event.target.value)}>
              {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Works On Vehicle" hint="Salary, advance and bata are booked to this vehicle's expenses. A driver also shows as the vehicle's driver.">
          <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={(value) => set('vehicleId', value)} allowEmpty emptyLabel="No vehicle (general / office)" />
        </Field>
      </FormSection>

      <FormSection number={2} title="Salary" tone="emerald">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(SALARY_TYPES).map(([key, type]) => (
            <button
              key={key}
              type="button"
              onClick={() => set('salaryType', key)}
              className={`rounded-lg border-2 bg-white px-3 py-2 text-left transition ${form.salaryType === key ? 'border-primary-600 ring-4 ring-primary-600/10' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <span className="block text-sm font-semibold text-slate-800">{type.label}</span>
              <span className="block text-[11px] text-slate-500">{type.hint}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          <Field label={form.salaryType === 'monthly' ? 'Salary' : 'Wage'} required>
            <MoneyInput value={form.rate} onChange={(value) => set('rate', value)} suffix={`/${SALARY_TYPES[form.salaryType].unit}`} required />
          </Field>
          <Field label="Joined On" required htmlFor="emp-join">
            <input id="emp-join" type="date" className="input" value={form.joinDate} onChange={(event) => set('joinDate', event.target.value)} required />
          </Field>
          <Field label="Opening Balance" hint="From before this software" className="col-span-2 md:col-span-1">
            <div className="flex gap-2">
              <MoneyInput value={form.openingBalance} onChange={(value) => set('openingBalance', value)} />
              <select className="input w-32 shrink-0" value={form.balanceSide} onChange={(event) => set('balanceSide', event.target.value)}>
                <option value="owed">I owe</option>
                <option value="advance">Advance</option>
              </select>
            </div>
          </Field>
        </div>
      </FormSection>

      <FormSection number={3} title="Licence & Other" tone="slate" hint="Licence expiry shows in Alerts, like vehicle documents">
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <Field label="Driving Licence No." htmlFor="emp-dl">
            <input id="emp-dl" className="input uppercase" value={form.licenseNo} onChange={(event) => set('licenseNo', event.target.value)} />
          </Field>
          <Field label="Licence Expiry" htmlFor="emp-dl-exp">
            <input id="emp-dl-exp" type="date" className="input" value={form.licenseExpiry} onChange={(event) => set('licenseExpiry', event.target.value)} />
          </Field>
          <Field label="Address" htmlFor="emp-address">
            <input id="emp-address" className="input" value={form.address} onChange={(event) => set('address', event.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="emp-notes">
            <input id="emp-notes" className="input" value={form.notes} onChange={(event) => set('notes', event.target.value)} />
          </Field>
        </div>
      </FormSection>
    </FormPopup>
  );
}
