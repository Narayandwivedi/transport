import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { currentMonthInput, formatDate, formatRupees, monthBounds } from '../utils/format';
import StatCard from '../components/StatCard';
import Segmented from '../components/Segmented';
import MonthFilter from '../components/MonthFilter';
import PaymentPopup from '../components/PaymentPopup';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, RowAction, TD, TH } from '../components/ui';

export default function Payments() {
  const [month, setMonth] = useState(currentMonthInput());
  const [type, setType] = useState('');
  const [editing, setEditing] = useState(null);
  const { data: payments, loading, error, reload } = useFetch('/payments', { ...monthBounds(month), type }, []);

  const list = payments || [];
  const received = list.filter((row) => row.type === 'received').reduce((total, row) => total + row.amount, 0);
  const paid = list.filter((row) => row.type === 'paid').reduce((total, row) => total + row.amount, 0);

  const handleDelete = async (payment) => {
    if (!window.confirm('Delete this payment?')) return;
    try {
      await apiClient.delete(`/payments/${payment._id}`);
      toast.success('Payment deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Page>
      <PageHeader title="Payments" subtitle="Money received from parties and paid to vehicle owners / suppliers">
        <button type="button" className="btn-primary" onClick={() => setEditing({})}><Plus size={18} /> Add Payment</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-3 gap-2 md:gap-3">
        <StatCard compact icon={ArrowDownLeft} tone="emerald" label="Received" value={formatRupees(received)} />
        <StatCard compact icon={ArrowUpRight} tone="rose" label="Paid" value={formatRupees(paid)} />
        <StatCard compact icon={Scale} tone="indigo" label="Net Cash" value={formatRupees(received - paid)} />
      </section>

      <section className="panel">
        <PanelHeader title="Payments" count={list.length} onRefresh={reload} loading={loading}>
          <Segmented value={type} onChange={setType} options={[{ key: '', label: 'All' }, { key: 'received', label: 'Received' }, { key: 'paid', label: 'Paid' }]} />
          <MonthFilter value={month} onChange={setMonth} />
        </PanelHeader>
        {loading && !list.length ? <Loading /> : list.length === 0 ? <EmptyState title="No payments this month" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>Party</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Mode</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {list.map((payment) => (
                  <tr key={payment._id} className="tbl-row">
                    <td className={`${TD} whitespace-nowrap`}>{formatDate(payment.date)}</td>
                    <td className={TD}>
                      <p className="font-semibold text-slate-800">{payment.partyId?.name || '—'}</p>
                      {payment.notes && <p className="text-xs text-slate-500">{payment.notes}</p>}
                    </td>
                    <td className={TD}>
                      <span className={payment.type === 'received' ? 'badge-green' : 'badge-red'}>{payment.type === 'received' ? 'Received' : 'Paid'}</span>
                    </td>
                    <td className={`${TD} uppercase`}>{payment.mode}{payment.reference ? ` · ${payment.reference}` : ''}</td>
                    <td className={`${TD} text-right font-semibold ${payment.type === 'received' ? 'text-emerald-700' : 'text-rose-700'}`}>{formatRupees(payment.amount)}</td>
                    <td className={TD}>
                      <div className="flex justify-end">
                        <RowAction title="Edit" icon={Pencil} onClick={() => setEditing(payment)} />
                        <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => handleDelete(payment)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <PaymentPopup payment={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={reload} />}
    </Page>
  );
}
