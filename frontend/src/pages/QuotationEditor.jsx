import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MessageCircle, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useMasters from '../utils/useMasters';
import { useAuth } from '../context/AuthContext';
import { QUOTE_BASIS_OPTIONS, calcAmount, getBasisLabel, getBasisUnit } from '../utils/constants';
import { addDays, amountInWords, formatDate, formatNumber, formatRupees, idOf, toDayInput, todayInput } from '../utils/format';
import { QUOTE_STATUS, quoteTotals } from '../utils/quotation';
import FormSection from '../components/FormSection';
import { PartySelect } from '../components/Pickers';
import { Field, Loading, MoneyInput, Page, PageHeader } from '../components/ui';

const EMPTY_ITEM = { description: 'Transportation charges', from: '', to: '', vehicleType: '', basis: 'per_trip', quantity: 1, rate: '' };

const newQuote = (user, item) => ({
  date: todayInput(),
  validTill: addDays(todayInput(), 15),
  partyId: '',
  customerName: '',
  customerAddress: '',
  subject: 'Quotation for transportation',
  items: [item ? { ...EMPTY_ITEM, ...item } : { ...EMPTY_ITEM }],
  gstPercent: 0,
  discount: '',
  terms: user?.quotationTerms || '',
  notes: '',
  status: 'draft',
});

// The printed sheet: company letterhead, customer, rate table, totals, terms, signature
function QuotationSheet({ quote, user, party, quoteNo }) {
  const totals = quoteTotals(quote);
  const customerName = party?.name || quote.customerName || '—';
  const customerAddress = party?.address || quote.customerAddress;
  return (
    <div className="print-sheet mx-auto max-w-[800px] bg-white p-6 text-[13px] text-slate-800 shadow-sm ring-1 ring-slate-200 md:p-10">
      <div className="flex items-start justify-between gap-4 border-b-2 border-primary-700 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-primary-800">{user?.companyName || user?.name}</h2>
          {user?.address && <p className="mt-1 max-w-sm whitespace-pre-line text-xs text-slate-600">{user.address}</p>}
          <p className="mt-1 text-xs text-slate-600">{[user?.mobile && `Mob: ${user.mobile}`, user?.email].filter(Boolean).join(' · ')}</p>
          {user?.gstin && <p className="text-xs font-semibold text-slate-600">GSTIN: {user.gstin}</p>}
        </div>
        <div className="text-right">
          <p className="text-xl font-extrabold tracking-[0.2em] text-slate-700">QUOTATION</p>
          <p className="mt-1 font-mono text-xs">{quoteNo || 'New'}</p>
          <p className="text-xs">Date: {formatDate(quote.date)}</p>
          {quote.validTill && <p className="text-xs">Valid till: {formatDate(quote.validTill)}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">To</p>
          <p className="text-base font-bold">{customerName}</p>
          {customerAddress && <p className="max-w-xs text-xs text-slate-600">{customerAddress}</p>}
          {party?.gstin && <p className="text-xs text-slate-600">GSTIN: {party.gstin}</p>}
        </div>
      </div>
      {quote.subject && <p className="mt-4"><span className="font-semibold">Subject:</span> {quote.subject}</p>}
      <p className="mt-2 text-slate-600">Dear Sir/Madam, we are pleased to quote our rates for transportation as below:</p>

      <table className="mt-3 w-full border-collapse text-left text-xs">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-2 py-2">#</th>
            <th className="px-2 py-2">Description</th>
            <th className="px-2 py-2">Route</th>
            <th className="px-2 py-2">Basis</th>
            <th className="px-2 py-2 text-right">Qty</th>
            <th className="px-2 py-2 text-right">Rate</th>
            <th className="px-2 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((item, index) => (
            <tr key={index} className="border-b border-slate-200">
              <td className="px-2 py-2 align-top">{index + 1}</td>
              <td className="px-2 py-2 align-top">
                <p className="font-semibold">{item.description}</p>
                {item.vehicleType && <p className="text-slate-500">{item.vehicleType}</p>}
              </td>
              <td className="px-2 py-2 align-top">{[item.from, item.to].filter(Boolean).join(' → ') || '—'}</td>
              <td className="px-2 py-2 align-top">{getBasisLabel(item.basis)}</td>
              <td className="px-2 py-2 text-right align-top">{item.basis === 'fixed' ? '—' : `${formatNumber(item.quantity, 3)} ${getBasisUnit(item.basis)}`}</td>
              <td className="px-2 py-2 text-right align-top">{formatRupees(item.rate)}</td>
              <td className="px-2 py-2 text-right align-top font-semibold">{formatRupees(calcAmount(item.basis, item.quantity, item.rate))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex justify-end">
        <div className="w-64 space-y-1 text-xs">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatRupees(totals.subtotal)}</span></div>
          {totals.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>− {formatRupees(totals.discount)}</span></div>}
          {Number(quote.gstPercent) > 0 && <div className="flex justify-between"><span>GST @ {quote.gstPercent}%</span><span>{formatRupees(totals.gst)}</span></div>}
          <div className="flex justify-between border-t-2 border-slate-800 pt-1 text-sm font-bold"><span>Total</span><span>{formatRupees(totals.total)}</span></div>
        </div>
      </div>
      <p className="mt-2 text-right text-xs italic text-slate-600">{amountInWords(totals.total)}</p>

      {quote.terms && (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Terms & Conditions</p>
          <p className="mt-1 whitespace-pre-line text-xs text-slate-700">{quote.terms}</p>
        </div>
      )}
      {quote.notes && <p className="mt-3 text-xs text-slate-700">{quote.notes}</p>}

      <div className="mt-12 flex justify-end">
        <div className="text-center text-xs">
          <p className="font-semibold">For {user?.companyName || user?.name}</p>
          <div className="mt-10 border-t border-slate-400 px-8 pt-1">Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
}

export default function QuotationEditor() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { parties } = useMasters();
  const [quote, setQuote] = useState(null);
  const [quoteNo, setQuoteNo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      apiClient.get(`/quotations/${id}`)
        .then((saved) => {
          setQuoteNo(saved.quoteNo);
          setQuote({ ...saved, partyId: idOf(saved.partyId), date: toDayInput(saved.date), validTill: toDayInput(saved.validTill) });
        })
        .catch((error) => toast.error(error.message));
      return;
    }
    const copyOf = location.state?.copyOf;
    if (copyOf) {
      setQuote({ ...newQuote(user), ...copyOf, _id: undefined, quoteNo: undefined, partyId: idOf(copyOf.partyId), date: todayInput(), validTill: addDays(todayInput(), 15), status: 'draft' });
    } else {
      setQuote(newQuote(user, location.state?.item));
    }
  }, [id, location.state, user]);

  if (!quote) return <Page><Loading /></Page>;

  const set = (field, value) => setQuote((prev) => ({ ...prev, [field]: value }));
  const setItem = (index, field, value) => setQuote((prev) => ({
    ...prev,
    items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
  }));
  const party = parties.find((item) => item._id === quote.partyId);
  const totals = quoteTotals(quote);

  const save = async (nextStatus) => {
    setSaving(true);
    try {
      const payload = { ...quote, status: nextStatus || quote.status };
      delete payload._id;
      delete payload.quoteNo;
      const saved = id ? await apiClient.put(`/quotations/${id}`, payload) : await apiClient.post('/quotations', payload);
      toast.success('Quotation saved');
      setQuoteNo(saved.quoteNo);
      set('status', saved.status);
      if (!id) navigate(`/quotations/${saved._id}`, { replace: true });
      return saved;
    } catch (error) {
      toast.error(error.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const shareOnWhatsApp = () => {
    const lines = quote.items.map((item) => `• ${item.description}${item.from || item.to ? ` (${[item.from, item.to].filter(Boolean).join(' → ')})` : ''}: ${formatRupees(item.rate)} ${getBasisLabel(item.basis).toLowerCase()}`);
    const text = [
      `*Quotation ${quoteNo || ''}* from ${user?.companyName || user?.name}`,
      `To: ${party?.name || quote.customerName}`,
      ...lines,
      `Total: ${formatRupees(totals.total)}${Number(quote.gstPercent) ? ` (incl. GST ${quote.gstPercent}%)` : ''}`,
      quote.validTill ? `Valid till ${formatDate(quote.validTill)}` : '',
    ].filter(Boolean).join('\n');
    const phone = String(party?.mobile || '').replace(/\D/g, '');
    window.open(`https://wa.me/${phone.length === 10 ? `91${phone}` : phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  return (
    <Page>
      <div className="no-print">
        <PageHeader title={quoteNo ? `Quotation ${quoteNo}` : 'New Quotation'} subtitle="Fill the left side; the sheet on the right is what prints">
          <select className="input w-auto" value={quote.status} onChange={(event) => set('status', event.target.value)}>
            {Object.entries(QUOTE_STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
          <button type="button" className="btn-secondary" onClick={shareOnWhatsApp}><MessageCircle size={16} /> WhatsApp</button>
          <button type="button" className="btn-secondary" onClick={async () => { if (await save()) setTimeout(() => window.print(), 300); }} disabled={saving}><Printer size={16} /> Save & Print</button>
          <button type="button" className="btn-primary" onClick={() => save()} disabled={saving}><Save size={16} /> Save</button>
        </PageHeader>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_820px]">
        <div className="no-print space-y-3">
          <FormSection number={1} title="Customer" tone="blue">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="Date" htmlFor="q-date"><input id="q-date" type="date" className="input" value={quote.date} onChange={(event) => set('date', event.target.value)} /></Field>
              <Field label="Valid Till" htmlFor="q-valid"><input id="q-valid" type="date" className="input" value={quote.validTill || ''} onChange={(event) => set('validTill', event.target.value)} /></Field>
              <Field label="Saved Party" className="col-span-2 md:col-span-1">
                <PartySelect parties={parties} value={quote.partyId} onChange={(value) => set('partyId', value)} prefer={['customer']} allowEmpty emptyLabel="Not saved — type below" />
              </Field>
            </div>
            {!quote.partyId && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Customer Name" htmlFor="q-cust"><input id="q-cust" className="input" value={quote.customerName} onChange={(event) => set('customerName', event.target.value)} /></Field>
                <Field label="Customer Address" htmlFor="q-addr"><input id="q-addr" className="input" value={quote.customerAddress} onChange={(event) => set('customerAddress', event.target.value)} /></Field>
              </div>
            )}
            <Field label="Subject" htmlFor="q-subject"><input id="q-subject" className="input" value={quote.subject} onChange={(event) => set('subject', event.target.value)} /></Field>
          </FormSection>

          <FormSection
            number={2}
            title="Rates"
            tone="emerald"
            action={<button type="button" className="btn-secondary btn-sm" onClick={() => set('items', [...quote.items, { ...EMPTY_ITEM }])}><Plus size={14} /> Line</button>}
          >
            {quote.items.map((item, index) => (
              <div key={index} className="space-y-2 rounded-lg bg-white p-3 ring-1 ring-emerald-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                  <input className="input flex-1" value={item.description} onChange={(event) => setItem(index, 'description', event.target.value)} placeholder="Description (material / work)" />
                  <button type="button" className="icon-btn p-1.5 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30" disabled={quote.items.length === 1} onClick={() => set('items', quote.items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove line">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  <input className="input" value={item.from} onChange={(event) => setItem(index, 'from', event.target.value)} placeholder="From" />
                  <input className="input" value={item.to} onChange={(event) => setItem(index, 'to', event.target.value)} placeholder="To" />
                  <input className="input col-span-2 md:col-span-1" value={item.vehicleType} onChange={(event) => setItem(index, 'vehicleType', event.target.value)} placeholder="Vehicle (e.g. 10 wheel, 25 T)" />
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <select className="input" value={item.basis} onChange={(event) => setItem(index, 'basis', event.target.value)}>
                    {QUOTE_BASIS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  {item.basis !== 'fixed' ? (
                    <MoneyInput prefix="" suffix={getBasisUnit(item.basis)} value={item.quantity} onChange={(value) => setItem(index, 'quantity', value)} />
                  ) : <span />}
                  <MoneyInput value={item.rate} onChange={(value) => setItem(index, 'rate', value)} suffix={getBasisUnit(item.basis) ? `/${getBasisUnit(item.basis)}` : ''} />
                  <div className="flex min-h-[2.5rem] items-center justify-end rounded-lg bg-emerald-50 px-3 text-sm font-bold text-emerald-700">{formatRupees(calcAmount(item.basis, item.quantity, item.rate))}</div>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Discount"><MoneyInput value={quote.discount} onChange={(value) => set('discount', value)} /></Field>
              <Field label="GST">
                <select className="input" value={quote.gstPercent} onChange={(event) => set('gstPercent', Number(event.target.value))}>
                  <option value={0}>No GST</option>
                  <option value={5}>5% (GTA, no ITC)</option>
                  <option value={12}>12% (GTA, with ITC)</option>
                  <option value={18}>18%</option>
                </select>
              </Field>
            </div>
          </FormSection>

          <FormSection number={3} title="Terms" tone="slate" hint="Default terms come from Settings">
            <textarea className="input min-h-[110px]" value={quote.terms} onChange={(event) => set('terms', event.target.value)} />
            <Field label="Note at the end" htmlFor="q-notes"><input id="q-notes" className="input" value={quote.notes} onChange={(event) => set('notes', event.target.value)} /></Field>
          </FormSection>
        </div>

        <div className="min-w-0 overflow-x-auto">
          <QuotationSheet quote={quote} user={user} party={party} quoteNo={quoteNo} />
        </div>
      </div>
    </Page>
  );
}
