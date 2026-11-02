import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useMasters from '../utils/useMasters';
import { formatRupees, idOf, toDayInput, todayInput } from '../utils/format';
import FormPopup from './FormPopup';
import FormSection, { AddLink, FieldGrid } from './FormSection';
import Segmented from './Segmented';
import PartyPopup from './PartyPopup';
import VehiclePopup from './VehiclePopup';
import { PartySelect, VehicleSelect } from './Pickers';
import { Field, MoneyInput } from './ui';

const DIRECTIONS = {
  hire_in: { title: 'Hire a Vehicle Monthly', party: 'Vehicle Owner', prefer: ['transporter'], hint: 'I take this vehicle and pay its owner every month' },
  give_out: { title: 'Give a Vehicle Monthly', party: 'Given To (Party)', prefer: ['customer'], hint: 'I give my vehicle (or one I hired) and charge the party every month' },
};

/**
 * Monthly rent, either way. Rent builds up day by day: a part month is charged for the days in it.
 * Leave the end date empty while the vehicle keeps running; set it when the vehicle is returned.
 */
export default function ContractPopup({ contract = null, direction = 'hire_in', onClose, onSaved }) {
  const { vehicles, parties, reload } = useMasters();
  const [form, setForm] = useState(() => (contract ? {
    ...contract,
    vehicleId: idOf(contract.vehicleId),
    partyId: idOf(contract.partyId),
    startDate: toDayInput(contract.startDate),
    endDate: toDayInput(contract.endDate),
  } : {
    direction, vehicleId: '', partyId: '', monthlyRate: '', startDate: todayInput(), endDate: '', dieselBy: 'hirer', driverBy: 'owner', notes: '',
  }));
  const [adding, setAdding] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const info = DIRECTIONS[form.direction];

  // Hiring in: only hired vehicles. Giving out: any vehicle.
  const vehicleChoices = form.direction === 'hire_in' ? vehicles.filter((vehicle) => vehicle.ownership === 'hired') : vehicles;

  const pickVehicle = (vehicleId) => {
    const vehicle = vehicles.find((item) => item._id === vehicleId);
    setForm((prev) => ({
      ...prev,
      vehicleId,
      partyId: prev.direction === 'hire_in' && vehicle?.ownerPartyId ? idOf(vehicle.ownerPartyId) : prev.partyId,
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (contract) await apiClient.put(`/contracts/${contract._id}`, payload);
      else await apiClient.post('/contracts', payload);
      toast.success('Monthly hire saved');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const perDay = Number(form.monthlyRate || 0) / 30;

  return (
    <>
      <FormPopup title={contract ? `Edit ${contract.contractNo}` : info.title} subtitle={info.hint} maxWidth="max-w-2xl" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving}>
        {!contract && (
          <Segmented
            className="w-full self-stretch"
            value={form.direction}
            onChange={(value) => setForm((prev) => ({ ...prev, direction: value, vehicleId: '', partyId: '' }))}
            options={[{ key: 'hire_in', label: 'Hire In (I pay)' }, { key: 'give_out', label: 'Give Out (I charge)' }]}
          />
        )}
        <FormSection number={1} title="Vehicle & Party" tone={form.direction === 'hire_in' ? 'amber' : 'emerald'}>
          <FieldGrid cols={2}>
            <Field label="Vehicle" required action={<AddLink onClick={() => setAdding('vehicle')}>New Vehicle</AddLink>} hint={form.direction === 'hire_in' ? 'Only vehicles added as "Hired Vehicle" show here' : 'Your own vehicle, or one you have hired in'}>
              <VehicleSelect vehicles={vehicleChoices} value={form.vehicleId} onChange={pickVehicle} required />
            </Field>
            <Field label={info.party} required action={<AddLink onClick={() => setAdding('party')}>New Party</AddLink>}>
              <PartySelect parties={parties} value={form.partyId} onChange={(value) => set('partyId', value)} prefer={info.prefer} required />
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection number={2} title="Rent & Period" tone="blue">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            <Field label="Monthly Rent" required hint={perDay ? `≈ ${formatRupees(Math.round(perDay))} a day` : ''}>
              <MoneyInput value={form.monthlyRate} onChange={(value) => set('monthlyRate', value)} suffix="/month" required />
            </Field>
            <Field label="Start Date" required htmlFor="ct-start">
              <input id="ct-start" type="date" className="input" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} required />
            </Field>
            <Field label="End Date" htmlFor="ct-end" hint="Empty: running until stopped">
              <input id="ct-end" type="date" className="input" value={form.endDate || ''} onChange={(event) => set('endDate', event.target.value)} min={form.startDate} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <Field label="Diesel Paid By">
              <select className="input" value={form.dieselBy} onChange={(event) => set('dieselBy', event.target.value)}>
                <option value="hirer">Hirer (whoever takes the vehicle)</option>
                <option value="owner">Owner</option>
              </select>
            </Field>
            <Field label="Driver By">
              <select className="input" value={form.driverBy} onChange={(event) => set('driverBy', event.target.value)}>
                <option value="owner">Owner</option>
                <option value="hirer">Hirer</option>
              </select>
            </Field>
          </div>
          <Field label="Notes" htmlFor="ct-notes">
            <textarea id="ct-notes" rows={2} className="input resize-none" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Site, working hours, terms…" />
          </Field>
        </FormSection>
      </FormPopup>

      {adding === 'party' && (
        <PartyPopup
          defaultType={form.direction === 'hire_in' ? 'transporter' : 'customer'}
          onClose={() => setAdding('')}
          onSaved={async (party) => {
            await reload();
            set('partyId', party._id);
          }}
        />
      )}
      {adding === 'vehicle' && (
        <VehiclePopup
          onClose={() => setAdding('')}
          onSaved={async (vehicle) => {
            await reload();
            pickVehicle(vehicle._id);
          }}
        />
      )}
    </>
  );
}
