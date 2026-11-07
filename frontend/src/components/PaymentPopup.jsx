import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useMasters from '../utils/useMasters';
import { PAYMENT_MODE_OPTIONS } from '../utils/constants';
import { idOf, toDayInput, todayInput } from '../utils/format';
import FormPopup from './FormPopup';
import FormSection, { FieldGrid } from './FormSection';
import Segmented from './Segmented';
import { PartySelect } from './Pickers';
import { Field, MoneyInput } from './ui';

// Money received from a party, or paid to a party
export default function PaymentPopup({ payment = null, preset = {}, onClose, onSaved }) {
  const { parties } = useMasters();
  const [form, setForm] = useState(() => (payment
    ? { ...payment, partyId: idOf(payment.partyId), date: toDayInput(payment.date) }
    : { date: todayInput(), type: 'received', partyId: '', amount: '', mode: 'cash', reference: '', notes: '', ...preset }));
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = { date: form.date, type: form.type, partyId: form.partyId, amount: form.amount, mode: form.mode, reference: form.reference, notes: form.notes };
      const saved = payment ? await apiClient.put(`/payments/${payment._id}`, payload) : await apiClient.post('/payments', payload);
      // A staff save with "save on approval" waits for the owner
      toast.success(saved?.pendingApproval ? 'Sent to the owner for approval' : 'Payment saved');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPopup title={payment ? 'Edit Payment' : 'Add Payment'} subtitle="Money in from a party, or money out to a party" maxWidth="max-w-2xl" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving}>
      <Segmented
        className="w-full self-stretch"
        value={form.type}
        onChange={(value) => set('type', value)}
        options={[{ key: 'received', label: 'Money Received' }, { key: 'paid', label: 'Money Paid' }]}
      />
      <FormSection number={1} title="Payment" tone={form.type === 'received' ? 'emerald' : 'rose'}>
        <FieldGrid cols={2}>
          <Field label="Date" required htmlFor="pay-date">
            <input id="pay-date" type="date" className="input" value={form.date} onChange={(event) => set('date', event.target.value)} required />
          </Field>
          <Field label="Amount" required>
            <MoneyInput value={form.amount} onChange={(value) => set('amount', value)} required />
          </Field>
          <Field label={form.type === 'received' ? 'Received From' : 'Paid To'} required className="sm:col-span-2">
            <PartySelect parties={parties} value={form.partyId} onChange={(value) => set('partyId', value)} prefer={form.type === 'received' ? ['customer'] : ['supplier']} required />
          </Field>
        </FieldGrid>
      </FormSection>
      <FormSection number={2} title="Mode & Reference" tone="slate">
        <FieldGrid cols={2}>
          <Field label="Mode">
            <select className="input" value={form.mode} onChange={(event) => set('mode', event.target.value)}>
              {PAYMENT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Reference / Cheque No." htmlFor="pay-ref">
            <input id="pay-ref" className="input" value={form.reference} onChange={(event) => set('reference', event.target.value)} placeholder="UTR, cheque no.…" />
          </Field>
          <Field label="Notes" htmlFor="pay-notes" className="sm:col-span-2">
            <textarea id="pay-notes" rows={2} className="input resize-none" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Any additional notes…" />
          </Field>
        </FieldGrid>
      </FormSection>
    </FormPopup>
  );
}
