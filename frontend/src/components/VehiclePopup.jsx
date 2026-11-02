import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useMasters from '../utils/useMasters';
import { BILLING_BASIS_OPTIONS, VEHICLE_CATEGORY_OPTIONS, getBasisUnit } from '../utils/constants';
import { idOf, todayInput } from '../utils/format';
import FormPopup from './FormPopup';
import FormSection, { AddLink } from './FormSection';
import PartyPopup from './PartyPopup';
import RouteRateFields from './RouteRateFields';
import { PartySelect } from './Pickers';
import { Field, MoneyInput } from './ui';

const OWNERSHIP = [
  { value: 'own', label: 'My Vehicle', hint: 'I own it. I can run trips or give it on monthly rent.' },
  { value: 'hired', label: 'Hired Vehicle', hint: "Another party's vehicle I hire per trip / km / ton or monthly" },
];

const EMPTY = {
  vehicleNo: '', category: 'truck', ownership: 'own', ownerPartyId: '', hireBasis: '', hireRate: '', routeRates: [],
  make: '', model: '', capacityTons: '', openingKm: '', driverName: '', driverMobile: '', status: 'active', notes: '',
};

export default function VehiclePopup({ vehicle = null, onClose, onSaved }) {
  const { parties, reload: reloadParties } = useMasters();
  const [form, setForm] = useState(() => (vehicle ? { ...EMPTY, ...vehicle, ownerPartyId: idOf(vehicle.ownerPartyId) } : EMPTY));
  const [addingParty, setAddingParty] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const isHired = form.ownership === 'hired';

  const handleSubmit = async () => {
    setSaving(true);
    const payload = { ...form };
    delete payload.openingKm;
    delete payload.currentKm;
    try {
      const saved = vehicle ? await apiClient.put(`/vehicles/${vehicle._id}`, payload) : await apiClient.post('/vehicles', payload);
      // The starting odometer is kept as the first meter reading
      if (!vehicle && Number(form.openingKm) > 0) {
        await apiClient.post('/meter-readings', { vehicleId: saved._id, date: todayInput(), openingReading: form.openingKm, closingReading: form.openingKm, notes: 'Odometer when added' });
      }
      toast.success(vehicle ? 'Vehicle updated' : 'Vehicle added');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormPopup title={vehicle ? 'Edit Vehicle' : 'Add Vehicle'} subtitle="Your own truck or a hired one" maxWidth="max-w-2xl" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving}>
        <FormSection number={1} title="Vehicle" tone="blue">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <Field label="Vehicle Number" required htmlFor="veh-no">
              <input id="veh-no" className="input font-mono uppercase" value={form.vehicleNo} onChange={(event) => set('vehicleNo', event.target.value.toUpperCase())} placeholder="CG04AB1234" required autoFocus />
            </Field>
            <Field label="Type" htmlFor="veh-cat">
              <select id="veh-cat" className="input" value={form.category} onChange={(event) => set('category', event.target.value)}>
                {VEHICLE_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {OWNERSHIP.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => set('ownership', option.value)}
                className={`rounded-lg border-2 bg-white px-3 py-2 text-left transition ${form.ownership === option.value ? 'border-primary-600 ring-4 ring-primary-600/10' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <span className="block text-sm font-semibold text-slate-800">{option.label}</span>
                <span className="block text-[11px] text-slate-500">{option.hint}</span>
              </button>
            ))}
          </div>
        </FormSection>

        {isHired && (
          <FormSection number={2} title="Hired From" tone="amber" hint="For monthly rent, leave the rate empty and add it in Monthly Hire.">
            <Field label="Vehicle Owner" required action={<AddLink onClick={() => setAddingParty(true)}>New Owner</AddLink>}>
              <PartySelect parties={parties} value={form.ownerPartyId} onChange={(value) => set('ownerPartyId', value)} prefer={['transporter']} required />
            </Field>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <Field label="Pay Owner">
                <select className="input" value={form.hireBasis} onChange={(event) => set('hireBasis', event.target.value)}>
                  <option value="">Monthly / no fixed rate</option>
                  {BILLING_BASIS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              {form.hireBasis && (
                <Field label="Rate">
                  <MoneyInput value={form.hireRate} onChange={(value) => set('hireRate', value)} suffix={getBasisUnit(form.hireBasis) ? `/${getBasisUnit(form.hireBasis)}` : ''} />
                </Field>
              )}
            </div>
          </FormSection>
        )}

        <FormSection
          number={isHired ? 3 : 2}
          title="Route Rates"
          tone="emerald"
          hint={isHired
            ? 'Agreed rate for each route, per trip, per km or per ton: what you bill the party and what you pay the owner. Filled in automatically on a trip.'
            : 'Agreed rate for each route this vehicle runs, per trip, per km or per ton. Filled in automatically when you add a trip.'}
        >
          <RouteRateFields routes={form.routeRates} isHired={isHired} onChange={(routeRates) => set('routeRates', routeRates)} />
        </FormSection>

        <FormSection number={isHired ? 4 : 3} title="Details" tone="slate">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            <Field label="Make" htmlFor="veh-make">
              <input id="veh-make" className="input" value={form.make} onChange={(event) => set('make', event.target.value)} placeholder="Tata / Ashok Leyland" />
            </Field>
            <Field label="Model" htmlFor="veh-model">
              <input id="veh-model" className="input" value={form.model} onChange={(event) => set('model', event.target.value)} />
            </Field>
            <Field label="Capacity">
              <MoneyInput prefix="" suffix="ton" value={form.capacityTons} onChange={(value) => set('capacityTons', value)} />
            </Field>
            <Field label="Driver Name" htmlFor="veh-driver">
              <input id="veh-driver" className="input" value={form.driverName} onChange={(event) => set('driverName', event.target.value)} />
            </Field>
            <Field label="Driver Mobile" htmlFor="veh-driver-mobile">
              <input id="veh-driver-mobile" className="input" value={form.driverMobile} onChange={(event) => set('driverMobile', event.target.value)} inputMode="tel" />
            </Field>
            {vehicle ? (
              <Field label="Status">
                <select className="input" value={form.status} onChange={(event) => set('status', event.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="sold">Sold / Returned</option>
                </select>
              </Field>
            ) : (
              <Field label="Current Odometer" hint="Saved as the first meter reading">
                <MoneyInput prefix="" suffix="km" value={form.openingKm} onChange={(value) => set('openingKm', value)} />
              </Field>
            )}
          </div>
          <Field label="Notes" htmlFor="veh-notes">
            <textarea id="veh-notes" rows={2} className="input resize-none" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Any additional notes…" />
          </Field>
        </FormSection>
      </FormPopup>

      {addingParty && (
        <PartyPopup
          defaultType="transporter"
          onClose={() => setAddingParty(false)}
          onSaved={async (party) => {
            await reloadParties();
            set('ownerPartyId', party._id);
          }}
        />
      )}
    </>
  );
}
