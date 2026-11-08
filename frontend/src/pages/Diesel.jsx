import { useState } from 'react';
import { Droplet, Fuel, IndianRupee, Pencil, Plus, Store, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import useMasters from '../utils/useMasters';
import { currentMonthInput, formatDate, formatNumber, formatRupees, monthBounds } from '../utils/format';
import { formatMeter } from '../utils/meter';
import StatCard from '../components/StatCard';
import MonthFilter from '../components/MonthFilter';
import DieselPopup from '../components/DieselPopup';
import { VehicleSelect } from '../components/Pickers';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, RowAction, TD, TH } from '../components/ui';

const MODE_LABEL = { cash: 'Cash', upi: 'UPI', bank: 'Bank' };

// Paid at the pump: entries saved before "paid now" existed count credit as nothing paid, the rest as all paid
const paidOf = (entry) => entry.paidAmount ?? (entry.mode === 'credit' ? 0 : entry.amount);

/** Diesel filled at petrol pumps, by vehicle and pump. Stocked diesel goes through Purchases and Issue Stock. */
export default function Diesel() {
  const [month, setMonth] = useState(currentMonthInput());
  const [vehicleId, setVehicleId] = useState('');
  const [editing, setEditing] = useState(null);
  const { vehicles } = useMasters();
  const { data: entries, loading, error, reload } = useFetch('/diesel-entries', { ...monthBounds(month), vehicleId }, []);

  const list = entries || [];
  const litres = list.reduce((total, row) => total + row.litres, 0);
  const amount = list.reduce((total, row) => total + row.amount, 0);
  const onCredit = list.reduce((total, row) => total + Math.max(0, row.amount - paidOf(row)), 0);

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete diesel entry ${entry.entryNo}? Its vehicle expense goes too.`)) return;
    try {
      await apiClient.delete(`/diesel-entries/${entry._id}`);
      toast.success('Diesel entry deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Page>
      <PageHeader title="Diesel" subtitle="Diesel filled at petrol pumps into vehicles. Booked as each vehicle's diesel cost.">
        <button type="button" className="btn-primary" onClick={() => setEditing({})}><Plus size={18} /> Diesel Purchase</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Droplet} tone="amber" label="Litres" value={`${formatNumber(litres)} ltr`} hint={`${list.length} fills`} />
        <StatCard compact icon={IndianRupee} tone="rose" label="Diesel Cost" value={formatRupees(amount)} hint={vehicleId ? 'This vehicle' : 'All vehicles'} />
        <StatCard compact icon={Fuel} tone="indigo" label="Average Rate" value={litres > 0 ? `${formatRupees(amount / litres)}/ltr` : '—'} />
        <StatCard compact icon={Store} tone={onCredit ? 'amber' : 'slate'} label="On Credit" value={formatRupees(onCredit)} hint="To pay the pumps" />
      </section>

      <section className="panel">
        <PanelHeader title="Diesel Purchases" count={list.length} onRefresh={reload} loading={loading}>
          <div className="w-48"><VehicleSelect vehicles={vehicles} value={vehicleId} onChange={setVehicleId} allowEmpty emptyLabel="All vehicles" includeSold /></div>
          <MonthFilter value={month} onChange={setMonth} />
        </PanelHeader>
        {loading && !list.length ? <Loading /> : list.length === 0 ? (
          <EmptyState title="No diesel this month" hint='Use "Diesel Purchase" when a vehicle fills at a pump.' />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>Vehicle / Trip</th>
                  <th className={TH}>Pump</th>
                  <th className={`${TH} text-right`}>Litres × Rate</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={`${TH} text-right`}>Meter</th>
                  <th className={TH}>Paid</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {list.map((entry) => (
                  <tr key={entry._id} className="tbl-row cursor-pointer" onClick={() => setEditing(entry)}>
                    <td className={`${TD} whitespace-nowrap`}>
                      <p>{formatDate(entry.date)}</p>
                      <p className="font-mono text-[11px] text-slate-500">{entry.entryNo}</p>
                    </td>
                    <td className={TD}>
                      <p className="font-mono font-semibold">{entry.vehicleId?.vehicleNo}</p>
                      <p className="text-xs text-slate-500">{entry.tripId ? `Trip ${entry.tripId.tripNo}${entry.tripId.from ? ` · ${entry.tripId.from} → ${entry.tripId.to}` : ''}` : 'No trip'}</p>
                    </td>
                    <td className={TD}>
                      <p>{entry.partyId?.name || 'Cash'}</p>
                      {entry.billNo && <p className="text-xs text-slate-500">Bill {entry.billNo}</p>}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right`}>{formatNumber(entry.litres)} ltr × {formatRupees(entry.rate)}</td>
                    <td className={`${TD} text-right font-semibold text-rose-700`}>{formatRupees(entry.amount)}</td>
                    <td className={`${TD} whitespace-nowrap text-right text-slate-500`}>{entry.meterReading > 0 ? formatMeter(entry.meterReading, entry.vehicleId) : '—'}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {paidOf(entry) <= 0 ? <span className="badge-orange">Credit</span> : (
                        <span className={paidOf(entry) >= entry.amount ? 'badge-green' : 'badge-orange'}>
                          {paidOf(entry) >= entry.amount ? 'Paid' : 'Partial'} · {MODE_LABEL[entry.mode] || 'Cash'}
                        </span>
                      )}
                      {paidOf(entry) > 0 && paidOf(entry) < entry.amount && <p className="mt-0.5 text-[11px] text-slate-500">paid {formatRupees(paidOf(entry))} · due {formatRupees(entry.amount - paidOf(entry))}</p>}
                    </td>
                    <td className={TD} onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end">
                        <RowAction title="Edit" icon={Pencil} onClick={() => setEditing(entry)} />
                        <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => handleDelete(entry)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <DieselPopup entry={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={reload} />}
    </Page>
  );
}
