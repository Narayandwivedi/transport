import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useMasters from '../utils/useMasters';
import { INVENTORY_CATEGORY_OPTIONS } from '../utils/constants';
import { formatNumber, formatRupees, idOf, toDayInput, todayInput, toNumber } from '../utils/format';
import { meterUnitOf } from '../utils/meter';
import FormPopup from './FormPopup';
import FormSection, { FieldGrid } from './FormSection';
import { PartySelect, VehicleSelect } from './Pickers';
import { Field, MoneyInput } from './ui';

export function ItemPopup({ item = null, onClose, onSaved }) {
  const [form, setForm] = useState(() => item || { name: '', category: 'tyre', unit: 'pcs', minStock: '', openingQty: '', openingRate: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = { name: form.name, category: form.category, unit: form.unit, minStock: form.minStock, notes: form.notes };
      const saved = item ? await apiClient.put(`/inventory/items/${item._id}`, payload) : await apiClient.post('/inventory/items', payload);
      // Stock already in hand when the item is added is kept as its first stock-in entry
      if (!item && toNumber(form.openingQty) > 0) {
        await apiClient.post('/inventory/txns', { date: todayInput(), type: 'purchase', itemId: saved._id, quantity: form.openingQty, rate: form.openingRate || 0, paidNow: true, notes: 'Opening stock' });
      }
      toast.success('Stock item saved');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPopup title={item ? 'Edit Stock Item' : 'Add Stock Item'} subtitle="Tyres, diesel, oil, spare parts kept in stock" maxWidth="max-w-xl" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving}>
      <FormSection number={1} title="Item" tone="blue">
      <Field label="Item Name" required htmlFor="item-name">
        <input id="item-name" className="input" value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="e.g. MRF Tyre 10.00-20" required autoFocus />
      </Field>
      <FieldGrid cols={2}>
        <Field label="Category">
          <select
            className="input"
            value={form.category}
            onChange={(event) => {
              const option = INVENTORY_CATEGORY_OPTIONS.find((row) => row.value === event.target.value);
              setForm((prev) => ({ ...prev, category: option.value, unit: item ? prev.unit : option.unit }));
            }}
          >
            {INVENTORY_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Unit" htmlFor="item-unit">
          <input id="item-unit" className="input" value={form.unit} onChange={(event) => set('unit', event.target.value)} placeholder="pcs, ltr" />
        </Field>
      </FieldGrid>
      </FormSection>
      {!item && (
        <FormSection number={2} title="Opening Stock" tone="emerald" hint="Stock already in hand today. Leave empty if you have none; buy more in Purchases.">
          <FieldGrid cols={2}>
            <Field label="Quantity in Hand">
              <MoneyInput prefix="" suffix={form.unit} value={form.openingQty} onChange={(value) => set('openingQty', value)} />
            </Field>
            <Field label="Rate" hint="Used for stock value and issue cost">
              <MoneyInput value={form.openingRate} onChange={(value) => set('openingRate', value)} suffix={form.unit ? `/${form.unit}` : ''} />
            </Field>
          </FieldGrid>
        </FormSection>
      )}
      <FormSection number={item ? 2 : 3} title="Stock Alert & Notes" tone="amber">
        <Field label="Low Stock Alert At" hint="Alert when stock falls to this. 0 = no alert.">
          <MoneyInput prefix="" suffix={form.unit} value={form.minStock} onChange={(value) => set('minStock', value)} />
        </Field>
        <Field label="Notes" htmlFor="item-notes">
          <textarea id="item-notes" rows={2} className="input resize-none" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Any additional notes…" />
        </Field>
      </FormSection>
    </FormPopup>
  );
}

/**
 * Buy stock into the store, or issue it to a vehicle. An issue is costed at the average purchase rate
 * and booked as that vehicle's expense automatically.
 */
export function TxnPopup({ txn = null, items, preset = {}, onClose, onSaved }) {
  const { vehicles, parties } = useMasters();
  const [form, setForm] = useState(() => (txn ? {
    ...txn,
    date: toDayInput(txn.date),
    itemId: idOf(txn.itemId),
    vehicleId: idOf(txn.vehicleId),
    partyId: idOf(txn.partyId),
    odometer: txn.odometer || '',
  } : { date: todayInput(), type: 'issue', itemId: '', quantity: '', rate: '', partyId: '', paidNow: true, vehicleId: '', odometer: '', notes: '', ...preset }));
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const item = items.find((row) => row._id === form.itemId);
  const isIssue = form.type === 'issue';

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (txn) await apiClient.put(`/inventory/txns/${txn._id}`, payload);
      else await apiClient.post('/inventory/txns', payload);
      toast.success(isIssue ? 'Issued to vehicle' : 'Purchase saved');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPopup
      title={txn ? 'Edit Entry' : isIssue ? 'Issue to Vehicle' : 'Buy Stock'}
      subtitle={isIssue ? 'Fit a tyre, fill diesel… costed at the average purchase rate' : 'Stock bought into the store'}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={saving}
      maxWidth="max-w-2xl"
      footerExtra={item && (
        <span className="text-slate-600">
          {isIssue
            ? <>Cost ≈ <b className="text-rose-700">{formatRupees(toNumber(form.quantity) * item.avgRate)}</b></>
            : <>Total <b className="text-slate-800">{formatRupees(toNumber(form.quantity) * toNumber(form.rate))}</b></>}
        </span>
      )}
    >
      <FormSection number={1} title={isIssue ? 'Item Issued' : 'Item Bought'} tone="blue">
        <FieldGrid cols={2}>
          <Field label="Date" required htmlFor="txn-date">
            <input id="txn-date" type="date" className="input" value={form.date} onChange={(event) => set('date', event.target.value)} required />
          </Field>
          <Field label="Item" required hint={item ? `In stock: ${formatNumber(item.stockQty)} ${item.unit} · avg ${formatRupees(item.avgRate)}` : ''}>
            <select className="input" value={form.itemId} onChange={(event) => set('itemId', event.target.value)} required>
              <option value="" disabled>Select item</option>
              {items.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
            </select>
          </Field>
          <Field label="Quantity" required>
            <MoneyInput prefix="" suffix={item?.unit || ''} value={form.quantity} onChange={(value) => set('quantity', value)} required />
          </Field>
          {!isIssue && (
            <Field label="Rate" required>
              <MoneyInput value={form.rate} onChange={(value) => set('rate', value)} suffix={item ? `/${item.unit}` : ''} required />
            </Field>
          )}
        </FieldGrid>
      </FormSection>

      {isIssue ? (
        <FormSection number={2} title="Vehicle" tone="amber" hint="Booked as this vehicle's expense, at the average purchase rate">
          <FieldGrid cols={2}>
            <Field label="Vehicle" required>
              <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={(value) => set('vehicleId', value)} required />
            </Field>
            <Field label="Meter Reading" hint="When fitted / filled">
              <MoneyInput prefix="" suffix={meterUnitOf(vehicles.find((item) => item._id === form.vehicleId))} value={form.odometer} onChange={(value) => set('odometer', value)} />
            </Field>
          </FieldGrid>
        </FormSection>
      ) : (
        <FormSection number={2} title="Supplier & Payment" tone="emerald">
          <FieldGrid cols={2}>
            <Field label="Supplier">
              <PartySelect parties={parties} value={form.partyId} onChange={(value) => set('partyId', value)} prefer={['supplier']} allowEmpty emptyLabel="Not saved / cash" />
            </Field>
            <Field label="Payment">
              <select className="input" value={form.paidNow ? 'yes' : 'no'} onChange={(event) => set('paidNow', event.target.value === 'yes')}>
                <option value="yes">Paid now</option>
                <option value="no" disabled={!form.partyId}>On credit (supplier ledger)</option>
              </select>
            </Field>
          </FieldGrid>
        </FormSection>
      )}

      <FormSection number={3} title="Notes" tone="slate">
        <textarea id="txn-notes" rows={2} className="input resize-none" aria-label="Notes" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder={isIssue ? 'e.g. front left tyre' : 'Bill no. or any additional notes…'} />
      </FormSection>
    </FormPopup>
  );
}
