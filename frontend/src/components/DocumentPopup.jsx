import { useState } from 'react';
import { FileUp, Paperclip, X } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useMasters from '../utils/useMasters';
import { DOCUMENT_TYPE_OPTIONS } from '../utils/constants';
import { addDays, idOf, toDayInput, todayInput } from '../utils/format';
import FormPopup from './FormPopup';
import { VehicleSelect } from './Pickers';
import { Field, MoneyInput } from './ui';

// Usual validity, to fill the expiry date from the issue date
const VALIDITY_DAYS = { insurance: 365, puc: 180, fitness: 365, tax: 365, gps: 365, permit: 365, national_permit: 365 };

/**
 * A vehicle document with its expiry date and an optional scan (photo or PDF).
 * Renewing adds a new record; the old one is kept and shown as renewed.
 */
export default function DocumentPopup({ doc = null, preset = {}, onClose, onSaved }) {
  const { vehicles } = useMasters();
  const [form, setForm] = useState(() => (doc ? {
    ...doc,
    vehicleId: idOf(doc.vehicleId),
    issueDate: toDayInput(doc.issueDate),
    expiryDate: toDayInput(doc.expiryDate),
    amount: doc.amount || '',
  } : { vehicleId: '', docType: 'insurance', docNumber: '', provider: '', issueDate: todayInput(), expiryDate: '', amount: '', notes: '', ...preset }));
  const [file, setFile] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [addExpense, setAddExpense] = useState(!doc);
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const fillExpiry = (docType, issueDate) => {
    const days = VALIDITY_DAYS[docType];
    if (days && issueDate) set('expiryDate', addDays(issueDate, days - 1));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const data = new FormData();
      ['vehicleId', 'docType', 'docNumber', 'provider', 'issueDate', 'expiryDate', 'amount', 'notes'].forEach((field) => data.append(field, form[field] ?? ''));
      if (file) data.append('file', file);
      if (removeFile) data.append('removeFile', 'true');
      if (doc) await apiClient.put(`/documents/${doc._id}`, data);
      else await apiClient.post('/documents', data);
      // What the renewal cost goes into the vehicle's expenses
      if (!doc && addExpense && Number(form.amount) > 0) {
        const label = DOCUMENT_TYPE_OPTIONS.find((option) => option.value === form.docType)?.label || 'Document';
        await apiClient.post('/expenses', {
          date: form.issueDate || todayInput(),
          vehicleId: form.vehicleId,
          category: label === 'Road Tax' ? 'Road Tax' : label.includes('Permit') ? 'Permit' : label,
          amount: form.amount,
          paidTo: form.provider,
          notes: form.docNumber ? `No. ${form.docNumber}` : '',
        });
      }
      toast.success('Document saved');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const hasStoredFile = doc?.file && !removeFile;

  return (
    <FormPopup title={doc ? 'Edit Document' : 'Add Document'} subtitle="Tax, insurance, fitness, PUC, GPS, permit… with expiry alert" maxWidth="max-w-lg" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving}>
      <Field label="Vehicle">
        <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={(value) => set('vehicleId', value)} required />
      </Field>
      <Field label="Document">
        <div className="grid grid-cols-3 gap-1.5">
          {DOCUMENT_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => { set('docType', option.value); if (!doc) fillExpiry(option.value, form.issueDate); }}
              className={`rounded-lg border-2 px-2 py-1.5 text-xs font-semibold transition ${form.docType === option.value ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Policy / Doc No." htmlFor="doc-no">
          <input id="doc-no" className="input" value={form.docNumber} onChange={(event) => set('docNumber', event.target.value)} />
        </Field>
        <Field label="Company / Office" htmlFor="doc-provider">
          <input id="doc-provider" className="input" value={form.provider} onChange={(event) => set('provider', event.target.value)} placeholder="e.g. ICICI Lombard, RTO" />
        </Field>
        <Field label="Issue / Start Date" htmlFor="doc-issue">
          <input id="doc-issue" type="date" className="input" value={form.issueDate} onChange={(event) => { set('issueDate', event.target.value); if (!doc) fillExpiry(form.docType, event.target.value); }} />
        </Field>
        <Field label="Expiry Date" htmlFor="doc-expiry">
          <input id="doc-expiry" type="date" className="input" value={form.expiryDate} onChange={(event) => set('expiryDate', event.target.value)} required />
        </Field>
        <Field label="Amount Paid">
          <MoneyInput value={form.amount} onChange={(value) => set('amount', value)} />
        </Field>
        {!doc && (
          <label className="flex items-end gap-2 pb-2 text-xs font-semibold text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-primary-600" checked={addExpense} onChange={(event) => setAddExpense(event.target.checked)} />
            Add amount to vehicle expenses
          </label>
        )}
      </div>

      <Field label="Scan / Photo (jpg, png, pdf · max 5 MB)">
        {hasStoredFile && !file ? (
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
            <span className="flex min-w-0 items-center gap-2"><Paperclip size={14} /> <span className="truncate">{doc.fileName || 'Attached file'}</span></span>
            <button type="button" className="icon-btn p-1" onClick={() => setRemoveFile(true)} aria-label="Remove file"><X size={14} /></button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:border-primary-400 hover:bg-primary-50/40">
            <FileUp size={18} className="text-primary-600" />
            <span className="truncate">{file ? file.name : 'Choose file'}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>
        )}
      </Field>
      <Field label="Notes" htmlFor="doc-notes">
        <input id="doc-notes" className="input" value={form.notes} onChange={(event) => set('notes', event.target.value)} />
      </Field>
    </FormPopup>
  );
}
