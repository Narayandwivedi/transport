import { Fragment, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, CircleStop, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { currentMonthInput, formatDate, formatMonth, formatRupees, idOf, todayInput } from '../utils/format';
import { STATUS_BADGES } from '../utils/constants';
import StatCard from '../components/StatCard';
import Segmented from '../components/Segmented';
import MonthFilter from '../components/MonthFilter';
import ContractPopup from '../components/ContractPopup';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, RowAction, TD, TH } from '../components/ui';

export default function MonthlyHire() {
  const [month, setMonth] = useState(currentMonthInput());
  const [direction, setDirection] = useState('');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState('');
  const { data: contracts, loading, error, reload } = useFetch('/contracts', { month }, []);

  const all = contracts || [];
  const list = all.filter((contract) => !direction || contract.direction === direction);
  const monthTotal = (dir) => all.filter((contract) => contract.direction === dir).reduce((total, contract) => total + contract.monthAmount, 0);
  const payable = monthTotal('hire_in');
  const receivable = monthTotal('give_out');

  // A vehicle hired in and given out again: what is left between the two rents
  const resold = all
    .filter((contract) => contract.direction === 'give_out')
    .map((out) => {
      const hiredIn = all.filter((contract) => contract.direction === 'hire_in' && idOf(contract.vehicleId) === idOf(out.vehicleId));
      if (!hiredIn.length) return null;
      const cost = hiredIn.reduce((total, contract) => total + contract.monthAmount, 0);
      return { id: out._id, vehicleNo: out.vehicleId?.vehicleNo, from: hiredIn[0].partyId?.name, to: out.partyId?.name, income: out.monthAmount, cost };
    })
    .filter(Boolean);

  const stopToday = async (contract) => {
    const day = window.prompt('Last day of the hire (YYYY-MM-DD). Rent is charged up to this day.', todayInput());
    if (!day) return;
    try {
      await apiClient.put(`/contracts/${contract._id}`, { endDate: day, vehicleId: idOf(contract.vehicleId), partyId: idOf(contract.partyId), direction: contract.direction });
      toast.success('Hire stopped');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (contract) => {
    if (!window.confirm(`Delete ${contract.contractNo}? All its monthly rent is removed from the ledgers.`)) return;
    try {
      await apiClient.delete(`/contracts/${contract._id}`);
      toast.success('Deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Page>
      <PageHeader title="Monthly Hire" subtitle="Vehicles you hire per month, and vehicles you give out per month">
        <button type="button" className="btn-secondary" onClick={() => setEditing({ direction: 'give_out' })}><ArrowDownLeft size={16} /> Give Out</button>
        <button type="button" className="btn-primary" onClick={() => setEditing({ direction: 'hire_in' })}><Plus size={18} /> Hire In</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={ArrowUpRight} tone="rose" label="Rent to Pay" value={formatRupees(payable)} hint={`Vehicles hired in · ${formatMonth(month)}`} />
        <StatCard compact icon={ArrowDownLeft} tone="emerald" label="Rent to Receive" value={formatRupees(receivable)} hint={`Vehicles given out · ${formatMonth(month)}`} />
        <StatCard compact icon={TrendingUp} tone={receivable - payable >= 0 ? 'blue' : 'rose'} label="Rent Margin" value={formatRupees(receivable - payable)} hint="Received minus paid" />
        <StatCard compact icon={CircleStop} tone="slate" label="Running Now" value={all.filter((contract) => contract.status === 'running').length} hint={`${all.length} in total`} />
      </section>

      {resold.length > 0 && (
        <section className="panel">
          <div className="panel-header py-2.5"><h2 className="text-sm font-bold text-slate-800">Hired In & Given Out · {formatMonth(month)}</h2></div>
          <div className="divide-y divide-slate-100">
            {resold.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <p><span className="font-mono font-semibold">{row.vehicleNo}</span> <span className="text-slate-500">from {row.from} → to {row.to}</span></p>
                <p className="text-slate-600">
                  {formatRupees(row.income)} − {formatRupees(row.cost)} = <span className={`font-bold ${row.income - row.cost >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatRupees(row.income - row.cost)}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <PanelHeader title="Monthly Hire" count={list.length} onRefresh={reload} loading={loading}>
          <Segmented value={direction} onChange={setDirection} options={[{ key: '', label: 'All' }, { key: 'hire_in', label: 'Hired In' }, { key: 'give_out', label: 'Given Out' }]} />
          <MonthFilter value={month} onChange={setMonth} />
        </PanelHeader>
        {loading && !all.length ? <Loading /> : list.length === 0 ? (
          <EmptyState title="No monthly hire yet" hint='"Hire In" a vehicle from its owner, or "Give Out" your vehicle to a party.' />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr>
                  <th className={TH} />
                  <th className={TH}>Hire</th>
                  <th className={TH}>Vehicle</th>
                  <th className={TH}>Party</th>
                  <th className={`${TH} text-right`}>Monthly</th>
                  <th className={TH}>Period</th>
                  <th className={`${TH} text-right`}>This Month</th>
                  <th className={`${TH} text-right`}>Till Today</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {list.map((contract) => (
                  <Fragment key={contract._id}>
                    <tr className="tbl-row cursor-pointer" onClick={() => setOpen(open === contract._id ? '' : contract._id)}>
                      <td className={`${TD} w-8 text-slate-400`}>{open === contract._id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                      <td className={TD}>
                        <p className="font-mono text-xs font-semibold">{contract.contractNo}</p>
                        <span className={contract.direction === 'hire_in' ? 'badge-orange' : 'badge-green'}>{contract.direction === 'hire_in' ? 'Hired In' : 'Given Out'}</span>
                      </td>
                      <td className={`${TD} whitespace-nowrap font-mono font-semibold`}>{contract.vehicleId?.vehicleNo}</td>
                      <td className={TD}>{contract.partyId?.name}</td>
                      <td className={`${TD} text-right font-semibold`}>{formatRupees(contract.monthlyRate)}</td>
                      <td className={TD}>
                        <p className="whitespace-nowrap text-xs">{formatDate(contract.startDate)} → {contract.endDate ? formatDate(contract.endDate) : 'running'}</p>
                        <span className={STATUS_BADGES[contract.status]?.className}>{STATUS_BADGES[contract.status]?.label}</span>
                      </td>
                      <td className={`${TD} text-right font-semibold ${contract.direction === 'hire_in' ? 'text-rose-700' : 'text-emerald-700'}`}>{formatRupees(contract.monthAmount)}</td>
                      <td className={`${TD} text-right`}>{formatRupees(contract.accruedTillToday)}</td>
                      <td className={TD}>
                        <div className="flex justify-end">
                          {contract.status !== 'ended' && <RowAction title="Stop hire" icon={CircleStop} tone="amber" onClick={() => stopToday(contract)} />}
                          <RowAction title="Edit" icon={Pencil} onClick={() => setEditing(contract)} />
                          <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => handleDelete(contract)} />
                        </div>
                      </td>
                    </tr>
                    {open === contract._id && (
                      <tr className="bg-slate-50/70">
                        <td />
                        <td colSpan={8} className="px-3 py-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Month by month up to today</p>
                          <div className="flex flex-wrap gap-2">
                            {contract.months.length === 0 && <span className="text-sm text-slate-500">Starts {formatDate(contract.startDate)}</span>}
                            {contract.months.map((segment) => (
                              <div key={segment.from} className="rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-slate-200">
                                <p className="font-semibold text-slate-700">{formatDate(segment.from)} – {formatDate(segment.to)}</p>
                                <p className="text-slate-500">{segment.days}/{segment.daysInMonth} days · <span className="font-semibold text-slate-800">{formatRupees(segment.amount)}</span></p>
                              </div>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-slate-500">Diesel by {contract.dieselBy} · Driver by {contract.driverBy}{contract.notes ? ` · ${contract.notes}` : ''}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <ContractPopup contract={editing._id ? editing : null} direction={editing.direction} onClose={() => setEditing(null)} onSaved={reload} />}
    </Page>
  );
}
