import { useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { currentMonthInput, formatDate, formatNumber, formatRupees, monthBounds } from '../utils/format';
import { getInventoryCategoryLabel } from '../utils/constants';
import StatCard from '../components/StatCard';
import Segmented from '../components/Segmented';
import MonthFilter from '../components/MonthFilter';
import { ItemPopup, TxnPopup } from '../components/InventoryPopups';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, RowAction, TD, TH } from '../components/ui';

export default function Inventory() {
  const [tab, setTab] = useState('stock');
  const [month, setMonth] = useState(currentMonthInput());
  const [txnType, setTxnType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [editingTxn, setEditingTxn] = useState(null);
  const { data: items, loading, error, reload: reloadItems } = useFetch('/inventory/items', {}, []);
  const { data: txns, loading: txnLoading, reload: reloadTxns } = useFetch('/inventory/txns', { ...monthBounds(month), type: txnType }, []);

  const itemList = items || [];
  const txnList = txns || [];
  const stockValue = itemList.reduce((total, item) => total + Math.max(0, item.stockQty) * item.avgRate, 0);
  const lowStock = itemList.filter((item) => item.minStock > 0 && item.stockQty <= item.minStock);
  const bought = txnList.filter((txn) => txn.type === 'purchase').reduce((total, txn) => total + txn.amount, 0);
  const issued = txnList.filter((txn) => txn.type === 'issue').reduce((total, txn) => total + txn.amount, 0);

  const reload = () => {
    reloadItems();
    reloadTxns();
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try {
      await apiClient.delete(`/inventory/items/${item._id}`);
      toast.success('Item deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteTxn = async (txn) => {
    if (!window.confirm('Delete this entry? Stock and the vehicle expense are corrected.')) return;
    try {
      await apiClient.delete(`/inventory/txns/${txn._id}`);
      toast.success('Entry deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Page>
      <PageHeader title="Inventory" subtitle="Tyres, diesel, oil and spares: buy into store, issue to vehicles">
        <button type="button" className="btn-secondary" onClick={() => setEditingItem({})}><Plus size={16} /> New Item</button>
        <button type="button" className="btn-secondary" onClick={() => setEditingTxn({ type: 'issue' })} disabled={!itemList.length}><ArrowUpFromLine size={16} /> Issue</button>
        <button type="button" className="btn-primary" onClick={() => setEditingTxn({ type: 'purchase' })} disabled={!itemList.length}><ArrowDownToLine size={16} /> Buy Stock</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Boxes} tone="indigo" label="Stock Value" value={formatRupees(stockValue)} hint={`${itemList.length} items`} />
        <StatCard compact icon={AlertTriangle} tone={lowStock.length ? 'rose' : 'slate'} label="Low Stock" value={lowStock.length} hint={lowStock.map((item) => item.name).join(', ') || 'All fine'} />
        <StatCard compact icon={ArrowDownToLine} tone="emerald" label="Bought (month)" value={formatRupees(bought)} />
        <StatCard compact icon={ArrowUpFromLine} tone="amber" label="Issued (month)" value={formatRupees(issued)} hint="Booked to vehicles" />
      </section>

      <Segmented value={tab} onChange={setTab} options={[{ key: 'stock', label: 'Stock in Hand', icon: Package }, { key: 'entries', label: 'Purchases & Issues', icon: ArrowDownToLine }]} />

      {tab === 'stock' ? (
        <section className="panel">
          <PanelHeader title="Items" count={itemList.length} onRefresh={reload} loading={loading} />
          {loading && !itemList.length ? <Loading /> : itemList.length === 0 ? <EmptyState title="No items yet" hint='Add tyres, diesel, oil… with "New Item", then "Buy Stock".' /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr>
                    <th className={TH}>Item</th>
                    <th className={TH}>Category</th>
                    <th className={`${TH} text-right`}>In Stock</th>
                    <th className={`${TH} text-right`}>Avg Rate</th>
                    <th className={`${TH} text-right`}>Value</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {itemList.map((item) => {
                    const low = item.minStock > 0 && item.stockQty <= item.minStock;
                    return (
                      <tr key={item._id} className="tbl-row">
                        <td className={TD}>
                          <p className="font-semibold text-slate-800">{item.name}</p>
                          {low && <span className="badge-red">Low stock (alert at {formatNumber(item.minStock)})</span>}
                        </td>
                        <td className={TD}>{getInventoryCategoryLabel(item.category)}</td>
                        <td className={`${TD} text-right font-semibold ${low ? 'text-rose-700' : 'text-slate-800'}`}>{formatNumber(item.stockQty)} {item.unit}</td>
                        <td className={`${TD} text-right`}>{formatRupees(item.avgRate)}</td>
                        <td className={`${TD} text-right`}>{formatRupees(Math.max(0, item.stockQty) * item.avgRate)}</td>
                        <td className={TD}>
                          <div className="flex justify-end">
                            <RowAction title="Buy" icon={ArrowDownToLine} tone="emerald" onClick={() => setEditingTxn({ type: 'purchase', itemId: item._id })} />
                            <RowAction title="Issue" icon={ArrowUpFromLine} tone="amber" onClick={() => setEditingTxn({ type: 'issue', itemId: item._id })} />
                            <RowAction title="Edit" icon={Pencil} onClick={() => setEditingItem(item)} />
                            <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => deleteItem(item)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="panel">
          <PanelHeader title="Entries" count={txnList.length} onRefresh={reload} loading={txnLoading}>
            <Segmented value={txnType} onChange={setTxnType} options={[{ key: '', label: 'All' }, { key: 'purchase', label: 'Bought' }, { key: 'issue', label: 'Issued' }]} />
            <MonthFilter value={month} onChange={setMonth} />
          </PanelHeader>
          {txnLoading && !txnList.length ? <Loading /> : txnList.length === 0 ? <EmptyState title="No entries this month" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left">
                <thead>
                  <tr>
                    <th className={TH}>Date</th>
                    <th className={TH}>Item</th>
                    <th className={TH}>Type</th>
                    <th className={TH}>Supplier / Vehicle</th>
                    <th className={`${TH} text-right`}>Qty × Rate</th>
                    <th className={`${TH} text-right`}>Amount</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {txnList.map((txn) => (
                    <tr key={txn._id} className="tbl-row">
                      <td className={`${TD} whitespace-nowrap`}>{formatDate(txn.date)}</td>
                      <td className={TD}>
                        <p className="font-semibold text-slate-800">{txn.itemId?.name}</p>
                        {txn.notes && <p className="text-xs text-slate-500">{txn.notes}</p>}
                      </td>
                      <td className={TD}><span className={txn.type === 'purchase' ? 'badge-green' : 'badge-orange'}>{txn.type === 'purchase' ? 'Bought' : 'Issued'}</span></td>
                      <td className={TD}>
                        {txn.type === 'purchase'
                          ? <>{txn.partyId?.name || 'Cash'}{!txn.paidNow && <span className="badge-red ml-1">Credit</span>}</>
                          : <span className="font-mono font-semibold">{txn.vehicleId?.vehicleNo || '—'}</span>}
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right`}>{formatNumber(txn.quantity)} {txn.itemId?.unit} × {formatRupees(txn.rate)}</td>
                      <td className={`${TD} text-right font-semibold`}>{formatRupees(txn.amount)}</td>
                      <td className={TD}>
                        <div className="flex justify-end">
                          <RowAction title="Edit" icon={Pencil} onClick={() => setEditingTxn(txn)} />
                          <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => deleteTxn(txn)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {editingItem && <ItemPopup item={editingItem._id ? editingItem : null} onClose={() => setEditingItem(null)} onSaved={reload} />}
      {editingTxn && (
        <TxnPopup
          txn={editingTxn._id ? editingTxn : null}
          preset={editingTxn._id ? {} : editingTxn}
          items={itemList}
          onClose={() => setEditingTxn(null)}
          onSaved={reload}
        />
      )}
    </Page>
  );
}
