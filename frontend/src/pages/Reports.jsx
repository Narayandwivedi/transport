import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, IndianRupee, Printer, TrendingUp, Wallet } from 'lucide-react';
import useFetch from '../utils/useFetch';
import { currentMonthInput, formatMonth, formatNumber, formatRupees } from '../utils/format';
import StatCard from '../components/StatCard';
import MonthFilter from '../components/MonthFilter';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, TD, TH } from '../components/ui';

const Money = ({ value, sign = '' }) => (value ? <>{sign}{formatRupees(value)}</> : <span className="text-slate-300">—</span>);

// Business profit for a month, and every vehicle's share of it
export default function Reports() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonthInput());
  const { data, loading, error, reload } = useFetch('/reports/profit', { month });

  if (loading && !data) return <Page><Loading /></Page>;
  const totals = data?.totals || {};
  const vehicles = data?.vehicles || [];
  const categories = Object.entries(data?.expenseByCategory || {}).sort((a, b) => b[1] - a[1]);
  const maxCategory = categories[0]?.[1] || 1;

  return (
    <Page>
      <PageHeader title="Profit Reports" subtitle={`Vehicle-wise and business profit · ${formatMonth(month)}`}>
        <MonthFilter value={month} onChange={setMonth} />
        <button type="button" className="btn-secondary no-print" onClick={() => window.print()}><Printer size={16} /> Print</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={IndianRupee} tone="emerald" label="Income" value={formatRupees(totals.income)} hint={`Trips ${formatRupees(totals.tripIncome)} · Rent ${formatRupees(totals.rentIncome)}`} />
        <StatCard compact icon={Wallet} tone="rose" label="Vehicle Costs" value={formatRupees(totals.tripHireCost + (totals.materialCost || 0) + totals.rentCost + totals.vehicleExpenses)} hint="Hire, material bought, rent and vehicle expenses" />
        <StatCard compact icon={Building2} tone="slate" label="General Expenses" value={formatRupees(totals.generalExpenses)} hint="Office and other, no vehicle" />
        <StatCard compact icon={TrendingUp} tone={(totals.profit || 0) >= 0 ? 'blue' : 'rose'} label="Net Profit" value={formatRupees(totals.profit)} hint="Whole business" />
      </section>

      <section className="panel">
        <PanelHeader title="Vehicle-wise Profit" count={vehicles.length} onRefresh={reload} loading={loading} />
        {vehicles.length === 0 ? <EmptyState title="No vehicles" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Vehicle</th>
                  <th className={`${TH} text-right`}>Trips</th>
                  <th className={`${TH} text-right`}>Trip Billing</th>
                  <th className={`${TH} text-right`}>Rent Received</th>
                  <th className={`${TH} text-right`}>Trip Hire</th>
                  <th className={`${TH} text-right`}>Material Cost</th>
                  <th className={`${TH} text-right`}>Rent Paid</th>
                  <th className={`${TH} text-right`}>Expenses</th>
                  <th className={`${TH} text-right`}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((row) => (
                  <tr key={row.vehicleId} className="tbl-row cursor-pointer" onClick={() => navigate(`/vehicles/${row.vehicleId}`)}>
                    <td className={TD}>
                      <p className="font-mono font-semibold text-slate-800">{row.vehicleNo}</p>
                      <p className="text-xs text-slate-500">{row.ownership === 'own' ? 'Mine' : `Hired · ${row.ownerName}`}{row.km ? ` · ${formatNumber(row.km, 0)} km` : ''}</p>
                    </td>
                    <td className={`${TD} text-right`}>{row.trips || '—'}</td>
                    <td className={`${TD} text-right text-emerald-700`}><Money value={row.tripIncome} /></td>
                    <td className={`${TD} text-right text-emerald-700`}><Money value={row.rentIncome} /></td>
                    <td className={`${TD} text-right text-rose-700`}><Money value={row.tripHireCost} sign="−" /></td>
                    <td className={`${TD} text-right text-rose-700`}><Money value={row.materialCost} sign="−" /></td>
                    <td className={`${TD} text-right text-rose-700`}><Money value={row.rentCost} sign="−" /></td>
                    <td className={`${TD} text-right text-rose-700`}><Money value={row.expenses} sign="−" /></td>
                    <td className={`${TD} text-right font-bold ${row.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatRupees(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td className={TD}>Vehicles total</td>
                  <td className={`${TD} text-right`}>{totals.trips}</td>
                  <td className={`${TD} text-right`}>{formatRupees(totals.tripIncome)}</td>
                  <td className={`${TD} text-right`}>{formatRupees(totals.rentIncome)}</td>
                  <td className={`${TD} text-right`}>{formatRupees(totals.tripHireCost)}</td>
                  <td className={`${TD} text-right`}>{formatRupees(totals.materialCost)}</td>
                  <td className={`${TD} text-right`}>{formatRupees(totals.rentCost)}</td>
                  <td className={`${TD} text-right`}>{formatRupees(totals.vehicleExpenses)}</td>
                  <td className={`${TD} text-right`}>{formatRupees(totals.profit + totals.generalExpenses)}</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className={TD} colSpan={8}>Less general / office expenses</td>
                  <td className={`${TD} text-right font-semibold text-rose-700`}>− {formatRupees(totals.generalExpenses)}</td>
                </tr>
                <tr className="bg-slate-100 text-base font-bold">
                  <td className={TD} colSpan={8}>Net business profit</td>
                  <td className={`${TD} text-right ${totals.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatRupees(totals.profit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header py-2.5"><h2 className="text-sm font-bold text-slate-800">Where the money went</h2></div>
        {categories.length === 0 ? <EmptyState title="No expenses this month" /> : (
          <div className="space-y-2.5 p-4 md:p-5">
            {categories.map(([category, amount]) => (
              <div key={category}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{category}</span>
                  <span className="font-semibold text-slate-800">{formatRupees(amount)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-primary-500" style={{ width: `${Math.max(2, (amount / maxCategory) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
