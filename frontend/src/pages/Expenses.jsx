import { useState } from 'react';
import { Building2, Fuel, Pencil, Plus, Trash2, Truck, Wallet } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import useMasters from '../utils/useMasters';
import { currentMonthInput, formatDate, formatRupees, monthBounds } from '../utils/format';
import StatCard from '../components/StatCard';
import MonthFilter from '../components/MonthFilter';
import ExpensePopup from '../components/ExpensePopup';
import { VehicleSelect } from '../components/Pickers';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, RowAction, TD, TH } from '../components/ui';

const SOURCE_BADGE = {
  inventory: { label: 'From Store', className: 'badge-blue' },
  maintenance: { label: 'Service', className: 'badge-orange' },
  payroll: { label: 'Payroll', className: 'badge-green' },
  trip: { label: 'Trip', className: 'badge-blue' },
};

export default function Expenses() {
  const [month, setMonth] = useState(currentMonthInput());
  const [vehicleId, setVehicleId] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const { vehicles } = useMasters();
  const { data: expenses, loading, error, reload } = useFetch('/expenses', { ...monthBounds(month), vehicleId, search }, []);

  const list = expenses || [];
  const total = list.reduce((sum, row) => sum + row.amount, 0);
  const onVehicles = list.filter((row) => row.vehicleId).reduce((sum, row) => sum + row.amount, 0);
  const diesel = list.filter((row) => row.category === 'Diesel').reduce((sum, row) => sum + row.amount, 0);

  // Biggest expense types this month
  const byCategory = Object.entries(list.reduce((acc, row) => ({ ...acc, [row.category]: (acc[row.category] || 0) + row.amount }), {}))
    .sort((a, b) => b[1] - a[1]);

  const handleEdit = (expense) => {
    if (['inventory', 'payroll', 'trip'].includes(expense.source)) {
      toast.info({
        inventory: 'This came from issuing store stock. Change it in Inventory.',
        payroll: 'This is a salary payment. Change it in Payroll.',
        trip: 'This was added on a trip. Change it in that trip.',
      }[expense.source]);
      return;
    }
    setEditing(expense);
  };

  const handleDelete = async (expense) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await apiClient.delete(`/expenses/${expense._id}`);
      toast.success('Expense deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Page>
      <PageHeader title="Expenses" subtitle="Everything spent, vehicle by vehicle">
        <button type="button" className="btn-primary" onClick={() => setEditing({})}><Plus size={18} /> Add Expense</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Wallet} tone="rose" label="Total Spent" value={formatRupees(total)} />
        <StatCard compact icon={Truck} tone="indigo" label="On Vehicles" value={formatRupees(onVehicles)} />
        <StatCard compact icon={Building2} tone="slate" label="General / Office" value={formatRupees(total - onVehicles)} />
        <StatCard compact icon={Fuel} tone="amber" label="Diesel" value={formatRupees(diesel)} />
      </section>

      {byCategory.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byCategory.slice(0, 8).map(([category, amount]) => (
            <span key={category} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {category} <span className="text-rose-700">{formatRupees(amount)}</span>
            </span>
          ))}
        </div>
      )}

      <section className="panel">
        <PanelHeader title="Expenses" count={list.length} search={search} onSearch={setSearch} searchPlaceholder="Search type, paid to" onRefresh={reload} loading={loading}>
          <div className="w-48"><VehicleSelect vehicles={vehicles} value={vehicleId} onChange={setVehicleId} allowEmpty emptyLabel="All vehicles" includeSold /></div>
          <MonthFilter value={month} onChange={setMonth} />
        </PanelHeader>
        {loading && !list.length ? <Loading /> : list.length === 0 ? <EmptyState title="No expenses this month" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Vehicle</th>
                  <th className={TH}>Paid To / Notes</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {list.map((expense) => (
                  <tr key={expense._id} className="tbl-row">
                    <td className={`${TD} whitespace-nowrap`}>{formatDate(expense.date)}</td>
                    <td className={TD}>
                      <p className="font-semibold text-slate-800">{expense.category}</p>
                      {SOURCE_BADGE[expense.source] && <span className={SOURCE_BADGE[expense.source].className}>{SOURCE_BADGE[expense.source].label}</span>}
                    </td>
                    <td className={`${TD} whitespace-nowrap font-mono`}>{expense.vehicleId?.vehicleNo || <span className="font-sans text-slate-400">General</span>}</td>
                    <td className={TD}>
                      <p>{expense.paidTo || '—'}</p>
                      {expense.notes && <p className="text-xs text-slate-500">{expense.notes}</p>}
                    </td>
                    <td className={`${TD} text-right font-semibold text-rose-700`}>{formatRupees(expense.amount)}</td>
                    <td className={TD}>
                      <div className="flex justify-end">
                        <RowAction title="Edit" icon={Pencil} onClick={() => handleEdit(expense)} />
                        {!['inventory', 'payroll', 'trip'].includes(expense.source) && <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => handleDelete(expense)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <ExpensePopup expense={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={reload} />}
    </Page>
  );
}
