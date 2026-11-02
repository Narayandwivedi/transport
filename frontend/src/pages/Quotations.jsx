import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, FileText, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { formatDate, formatRupees } from '../utils/format';
import { QUOTE_STATUS, quoteTotals } from '../utils/quotation';
import StatCard from '../components/StatCard';
import Segmented from '../components/Segmented';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, RowAction, TD, TH } from '../components/ui';

export default function Quotations() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const { data: quotes, loading, error, reload } = useFetch('/quotations', { status, search }, []);
  const list = quotes || [];
  const count = (key) => list.filter((quote) => quote.status === key).length;

  const handleDelete = async (quote) => {
    if (!window.confirm(`Delete quotation ${quote.quoteNo}?`)) return;
    try {
      await apiClient.delete(`/quotations/${quote._id}`);
      toast.success('Quotation deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const duplicate = (quote) => navigate('/quotations/new', { state: { copyOf: quote } });

  return (
    <Page>
      <PageHeader title="Quotations" subtitle="Rate quotes for parties: per trip, per km, per ton or monthly">
        <button type="button" className="btn-primary" onClick={() => navigate('/quotations/new')}><Plus size={18} /> New Quotation</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={FileText} tone="indigo" label="Quotations" value={list.length} />
        <StatCard compact icon={Pencil} tone="slate" label="Draft" value={count('draft')} />
        <StatCard compact icon={Send} tone="blue" label="Sent" value={count('sent')} />
        <StatCard compact icon={CheckCircle2} tone="emerald" label="Accepted" value={count('accepted')} />
      </section>

      <section className="panel">
        <PanelHeader title="All Quotations" count={list.length} search={search} onSearch={setSearch} searchPlaceholder="Search no. or customer" onRefresh={reload} loading={loading}>
          <Segmented value={status} onChange={setStatus} options={[{ key: '', label: 'All' }, ...Object.entries(QUOTE_STATUS).map(([key, value]) => ({ key, label: value.label }))]} />
        </PanelHeader>
        {loading && !list.length ? <Loading /> : list.length === 0 ? (
          <EmptyState title="No quotations yet" hint='Make one with "New Quotation", or from the Cost Calculator.' />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Quotation</th>
                  <th className={TH}>Customer</th>
                  <th className={TH}>Route / Subject</th>
                  <th className={`${TH} text-right`}>Total</th>
                  <th className={TH}>Status</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {list.map((quote) => (
                  <tr key={quote._id} className="tbl-row cursor-pointer" onClick={() => navigate(`/quotations/${quote._id}`)}>
                    <td className={TD}>
                      <p className="font-mono text-xs font-semibold">{quote.quoteNo}</p>
                      <p className="text-xs text-slate-500">{formatDate(quote.date)}</p>
                    </td>
                    <td className={`${TD} font-semibold text-slate-800`}>{quote.partyId?.name || quote.customerName}</td>
                    <td className={TD}>{quote.subject || [quote.items[0]?.from, quote.items[0]?.to].filter(Boolean).join(' → ') || quote.items[0]?.description}</td>
                    <td className={`${TD} text-right font-semibold`}>{formatRupees(quoteTotals(quote).total)}</td>
                    <td className={TD}><span className={QUOTE_STATUS[quote.status]?.className}>{QUOTE_STATUS[quote.status]?.label}</span></td>
                    <td className={TD}>
                      <div className="flex justify-end">
                        <RowAction title="Open" icon={Pencil} onClick={() => navigate(`/quotations/${quote._id}`)} />
                        <RowAction title="Copy as new" icon={Copy} tone="emerald" onClick={() => duplicate(quote)} />
                        <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => handleDelete(quote)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Page>
  );
}
