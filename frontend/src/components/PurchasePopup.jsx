import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useMasters from '../utils/useMasters';
import { PAYMENT_MODE_OPTIONS } from '../utils/constants';
import { formatNumber, formatRupees, idOf, toDayInput, todayInput, toNumber } from '../utils/format';
import FormPopup from './FormPopup';
import FormSection, { AddLink, FieldGrid } from './FormSection';
import PartyPopup from './PartyPopup';
import { ItemPopup } from './InventoryPopups';
import { PartySelect } from './Pickers';
import { Field, MoneyInput } from './ui';

const EMPTY_LINE = { itemId: '', quantity: '', rate: '' };

/**
 * A purchase bill: several stock items bought from one supplier (or for cash).
 * Saving adds each item's quantity to stock; what is not paid now is owed to the supplier.
 * preset.itemId starts the first line with that item.
 */
export default function PurchasePopup({ purchase = null, items, preset = {}, onClose, onSaved, onItemAdded }) {
  const { parties, reload: reloadParties } = useMasters();
  const [form, setForm] = useState(() => (purchase ? {
    date: toDayInput(purchase.date),
    partyId: idOf(purchase.partyId),
    supplierInvoice: purchase.supplierInvoice || '',
    lines: (purchase.items || []).map((line) => ({ itemId: idOf(line.itemId), quantity: String(line.quantity), rate: String(line.rate) })),
    paidAmount: String(purchase.paidAmount || ''),
    mode: purchase.mode || 'cash',
    notes: purchase.notes || '',
  } : {
    date: todayInput(), partyId: '', supplierInvoice: '', lines: [{ ...EMPTY_LINE, itemId: preset.itemId || '' }], paidAmount: '', mode: 'cash', notes: '',
  }));
  const [paidTouched, setPaidTouched] = useState(Boolean(purchase));
  const [addingItemFor, setAddingItemFor] = useState(null);
  const [addingParty, setAddingParty] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const setLine = (index, field, value) => setForm((prev) => ({
    ...prev,
    lines: prev.lines.map((line, at) => (at === index ? { ...line, [field]: value } : line)),
  }));
  const addLine = () => setForm((prev) => ({ ...prev, lines: [...prev.lines, { ...EMPTY_LINE }] }));
  const removeLine = (index) => setForm((prev) => ({ ...prev, lines: prev.lines.length > 1 ? prev.lines.filter((_, at) => at !== index) : [{ ...EMPTY_LINE }] }));

  // A stock item picked on a line: its last average rate fills the rate until one is typed
  const pickItem = (index, itemId) => {
    const item = items.find((row) => row._id === itemId);
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, at) => (at === index ? { ...line, itemId, rate: line.rate || (item?.avgRate ? String(item.avgRate) : '') } : line)),
    }));
  };

  const total = form.lines.reduce((sum, line) => sum + toNumber(line.quantity) * toNumber(line.rate), 0);
  const hasParty = Boolean(form.partyId);
  // No supplier saved: a cash purchase, paid in full. With a supplier, paid in full until another amount is typed.
  const paid = !hasParty ? total : paidTouched ? toNumber(form.paidAmount) : total;
  const balance = total - paid;

  const handleSubmit = async () => {
    const lines = form.lines.filter((line) => line.itemId || toNumber(line.quantity) > 0);
    if (!lines.length) return toast.error('Add at least one item');
    if (lines.some((line) => !line.itemId)) return toast.error('Pick the stock item on every line');
    if (lines.some((line) => !(toNumber(line.quantity) > 0))) return toast.error('Enter the quantity on every line');
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        partyId: form.partyId,
        supplierInvoice: form.supplierInvoice,
        items: lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity, rate: line.rate || 0 })),
        paidAmount: paid,
        mode: form.mode,
        notes: form.notes,
      };
      if (purchase) await apiClient.put(`/purchases/${purchase._id}`, payload);
      else await apiClient.post('/purchases', payload);
      toast.success(purchase ? 'Purchase updated' : 'Purchase saved, stock added');
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
        title={purchase ? `Edit Purchase ${purchase.purchaseNo}` : 'Add Purchase'}
        subtitle="Stock items bought from a supplier. Each item's quantity is added to stock."
        maxWidth="max-w-3xl"
        onClose={onClose}
        onSubmit={handleSubmit}
        submitDisabled={saving}
        footerExtra={(
          <span className="text-slate-600">
            Total <b className="text-slate-900">{formatRupees(total)}</b>
            {hasParty && balance !== 0 && <> · {balance > 0 ? 'Due' : 'Advance'} <b className={balance > 0 ? 'text-rose-700' : 'text-emerald-700'}>{formatRupees(Math.abs(balance))}</b></>}
          </span>
        )}
      >
        <FormSection number={1} title="Purchase Details" tone="blue">
          <FieldGrid cols={3}>
            <Field label="Date" required htmlFor="pur-date">
              <input id="pur-date" type="date" className="input" value={form.date} onChange={(event) => set('date', event.target.value)} required />
            </Field>
            <Field label="Supplier" action={<AddLink onClick={() => setAddingParty(true)}>New</AddLink>}>
              <PartySelect parties={parties} value={form.partyId} onChange={(value) => set('partyId', value)} prefer={['supplier']} allowEmpty emptyLabel="Cash (no party)" />
            </Field>
            <Field label="Supplier Bill No." htmlFor="pur-invoice">
              <input id="pur-invoice" className="input" value={form.supplierInvoice} onChange={(event) => set('supplierInvoice', event.target.value)} placeholder="Optional" />
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection
          number={2}
          title="Items"
          tone="emerald"
          action={<AddLink onClick={() => setAddingItemFor(form.lines.length - 1)}>New Stock Item</AddLink>}
        >
          <div className="space-y-2">
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
              <span>Stock Item</span><span>Qty</span><span>Rate</span><span className="text-right">Amount</span><span className="w-8" />
            </div>
            {form.lines.map((line, index) => {
              const item = items.find((row) => row._id === line.itemId);
              return (
                <div key={index} className="grid grid-cols-2 gap-2 rounded-lg bg-white/70 p-2 ring-1 ring-emerald-200 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:bg-transparent md:p-0 md:ring-0">
                  <div className="col-span-2 md:col-span-1">
                    <select
                      className="input"
                      aria-label="Stock item"
                      value={line.itemId}
                      onChange={(event) => (event.target.value === '__new' ? setAddingItemFor(index) : pickItem(index, event.target.value))}
                    >
                      <option value="">Select item</option>
                      {items.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                      <option value="__new">+ Add new stock item…</option>
                    </select>
                    {item && <p className="mt-0.5 px-1 text-[11px] text-slate-500">In stock {formatNumber(item.stockQty)} {item.unit}</p>}
                  </div>
                  <MoneyInput prefix="" suffix={item?.unit || ''} aria-label="Quantity" placeholder="Qty" value={line.quantity} onChange={(value) => setLine(index, 'quantity', value)} />
                  <MoneyInput aria-label="Rate" placeholder="Rate" suffix={item ? `/${item.unit}` : ''} value={line.rate} onChange={(value) => setLine(index, 'rate', value)} />
                  <p className="self-center text-sm font-semibold text-slate-800 md:text-right">{formatRupees(toNumber(line.quantity) * toNumber(line.rate))}</p>
                  <button type="button" title="Remove line" aria-label="Remove line" className="justify-self-end rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => removeLine(index)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
            <button type="button" className="btn-secondary btn-sm" onClick={addLine}><Plus size={14} /> Add Line</button>
          </div>
        </FormSection>

        <FormSection number={3} title="Payment" tone="amber" hint={hasParty ? 'Whatever is not paid now is added to the supplier\'s ledger.' : 'No supplier picked: saved as a cash purchase, paid in full.'}>
          <FieldGrid cols={3}>
            <Field label="Total Amount">
              <p className="input flex items-center bg-slate-50 font-bold text-slate-900">{formatRupees(total)}</p>
            </Field>
            <Field label="Paid Now" action={hasParty && (
              <span className="flex gap-2">
                <button type="button" className="text-xs font-semibold text-primary-600 hover:underline" onClick={() => { setPaidTouched(true); set('paidAmount', String(total)); }}>Full</button>
                <button type="button" className="text-xs font-semibold text-primary-600 hover:underline" onClick={() => { setPaidTouched(true); set('paidAmount', '0'); }}>Credit</button>
              </span>
            )}>
              <MoneyInput
                value={hasParty ? (paidTouched ? form.paidAmount : String(total || '')) : String(total || '')}
                onChange={(value) => { setPaidTouched(true); set('paidAmount', value); }}
                disabled={!hasParty}
              />
            </Field>
            <Field label="Paid By">
              <select className="input" value={form.mode} onChange={(event) => set('mode', event.target.value)} disabled={paid <= 0}>
                {PAYMENT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection number={4} title="Notes" tone="slate">
          <textarea rows={2} className="input resize-none" aria-label="Notes" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Optional" />
        </FormSection>
      </FormPopup>

      {addingItemFor !== null && (
        <ItemPopup
          onClose={() => setAddingItemFor(null)}
          onSaved={async (saved) => {
            await onItemAdded?.();
            const index = Math.max(0, addingItemFor);
            setForm((prev) => {
              const lines = [...prev.lines];
              // The new item goes on the line it was asked from, or a new line when that one is taken
              if (lines[index] && !lines[index].itemId) lines[index] = { ...lines[index], itemId: saved._id };
              else lines.push({ ...EMPTY_LINE, itemId: saved._id });
              return { ...prev, lines };
            });
          }}
        />
      )}
      {addingParty && (
        <PartyPopup
          defaultType="supplier"
          onClose={() => setAddingParty(false)}
          onSaved={async (party) => {
            await reloadParties();
            set('partyId', party._id);
          }}
        />
      )}
    </>
  );
}
