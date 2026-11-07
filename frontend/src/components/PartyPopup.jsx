import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import { PARTY_TYPE_OPTIONS } from '../utils/constants';
import FormPopup from './FormPopup';
import FormSection, { FieldGrid } from './FormSection';
import { Field, MoneyInput } from './ui';

const EMPTY = { name: '', type: 'customer', mobile: '', address: '', gstin: '', openingBalance: '', balanceSide: 'receivable', notes: '' };

/**
 * Add or edit a party. onSaved gets the saved party, so a form can pick a party it just added.
 * Opening balance: "they owe me" is stored positive, "I owe them" negative.
 */
export default function PartyPopup({ party = null, defaultType = 'customer', onClose, onSaved }) {
  const [form, setForm] = useState(() => (party ? {
    ...EMPTY,
    ...party,
    openingBalance: party.openingBalance ? Math.abs(party.openingBalance) : '',
    balanceSide: party.openingBalance < 0 ? 'payable' : 'receivable',
  } : { ...EMPTY, type: defaultType }));
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    const opening = Number(form.openingBalance || 0);
    const payload = {
      name: form.name,
      type: form.type,
      mobile: form.mobile,
      address: form.address,
      gstin: form.gstin,
      notes: form.notes,
      openingBalance: form.balanceSide === 'payable' ? -opening : opening,
    };
    try {
      const saved = party ? await apiClient.put(`/parties/${party._id}`, payload) : await apiClient.post('/parties', payload);
      toast.success(party ? 'Party updated' : 'Party added');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPopup title={party ? 'Edit Party' : 'Add Party'} subtitle="Customer or supplier" maxWidth="max-w-2xl" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving}>
      <FormSection number={1} title="Party" tone="blue">
        <Field label="Party Name" required htmlFor="party-name">
          <input id="party-name" className="input" value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="e.g. Shree Cement Ltd." required autoFocus />
        </Field>
        <Field label="Type">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PARTY_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => set('type', option.value)}
                className={`rounded-lg border-2 bg-white px-3 py-2 text-left transition ${form.type === option.value ? 'border-primary-600 ring-4 ring-primary-600/10' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <span className="block text-sm font-semibold text-slate-800">{option.label}</span>
                {option.hint && <span className="block text-[11px] text-slate-500">{option.hint}</span>}
              </button>
            ))}
          </div>
        </Field>
      </FormSection>

      <FormSection number={2} title="Contact" tone="sky">
        <FieldGrid cols={2}>
          <Field label="Mobile" htmlFor="party-mobile">
            <input id="party-mobile" className="input" value={form.mobile} onChange={(event) => set('mobile', event.target.value)} inputMode="tel" placeholder="10-digit mobile" />
          </Field>
          <Field label="GSTIN" htmlFor="party-gstin">
            <input id="party-gstin" className="input uppercase" value={form.gstin} onChange={(event) => set('gstin', event.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Address" htmlFor="party-address" className="sm:col-span-2">
            <input id="party-address" className="input" value={form.address} onChange={(event) => set('address', event.target.value)} />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection number={3} title="Opening Balance" tone="emerald" hint="Money pending from before you started using this software">
        <FieldGrid cols={2}>
          <Field label="Amount">
            <MoneyInput value={form.openingBalance} onChange={(value) => set('openingBalance', value)} />
          </Field>
          <Field label="Balance Is">
            <select className="input" value={form.balanceSide} onChange={(event) => set('balanceSide', event.target.value)}>
              <option value="receivable">They owe me</option>
              <option value="payable">I owe them</option>
            </select>
          </Field>
          <Field label="Notes" htmlFor="party-notes" className="sm:col-span-2">
            <textarea id="party-notes" rows={2} className="input resize-none" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Any additional notes…" />
          </Field>
        </FieldGrid>
      </FormSection>
    </FormPopup>
  );
}
