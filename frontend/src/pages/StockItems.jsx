import { useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Package, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { formatNumber, formatRupees } from '../utils/format';
import { INVENTORY_CATEGORY_OPTIONS, getInventoryCategoryLabel } from '../utils/constants';
import StatCard from '../components/StatCard';
import Segmented from '../components/Segmented';
import { ItemPopup, TxnPopup } from '../components/InventoryPopups';
import PurchasePopup from '../components/PurchasePopup';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, RowAction, TD, TH } from '../components/ui';

/** Stock Items master: the tyres, diesel, oil and spares kept in store, with what is in hand of each. */
export default function StockItems() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [buying, setBuying] = useState(null);
  const [issuing, setIssuing] = useState(null);
  const { data: items, loading, error, reload } = useFetch('/inventory/items', { search, category }, []);
  // Every item, whatever the filter: a purchase or issue can pick any of them
  const { data: allItems, reload: reloadAll } = useFetch('/inventory/items', {}, []);

  const list = items || [];
  const everyItem = allItems || [];
  const stockValue = everyItem.reduce((total, item) => total + Math.max(0, item.stockQty) * item.avgRate, 0);
  const lowStock = everyItem.filter((item) => item.minStock > 0 && item.stockQty <= item.minStock);
  const outOfStock = everyItem.filter((item) => item.stockQty <= 0);

  const refresh = () => {
    reload();
    reloadAll();
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try {
      await apiClient.delete(`/inventory/items/${item._id}`);
      toast.success('Stock item deleted');
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Page>
      <PageHeader title="Stock Items" subtitle="Tyres, diesel, oil, spare parts kept in store. Buy them in Purchases, issue them to vehicles.">
        <button type="button" className="btn-secondary" onClick={() => setBuying({})}><ShoppingCart size={16} /> Add Purchase</button>
        <button type="button" className="btn-primary" onClick={() => setEditingItem({})}><Plus size={18} /> Add Stock Item</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Package} tone="indigo" label="Stock Items" value={everyItem.length} />
        <StatCard compact icon={Boxes} tone="emerald" label="Stock Value" value={formatRupees(stockValue)} hint="At average purchase rate" />
        <StatCard compact icon={AlertTriangle} tone={lowStock.length ? 'rose' : 'slate'} label="Low Stock" value={lowStock.length} hint={lowStock.map((item) => item.name).join(', ') || 'All fine'} />
        <StatCard compact icon={ArrowUpFromLine} tone={outOfStock.length ? 'amber' : 'slate'} label="Out of Stock" value={outOfStock.length} />
      </section>

      <section className="panel">
        <PanelHeader title="All Stock Items" count={list.length} search={search} onSearch={setSearch} searchPlaceholder="Search item" onRefresh={refresh} loading={loading}>
          <Segmented value={category} onChange={setCategory} options={[{ key: '', label: 'All' }, ...INVENTORY_CATEGORY_OPTIONS.map((option) => ({ key: option.value, label: option.label }))]} />
        </PanelHeader>
        {loading && !list.length ? <Loading /> : list.length === 0 ? (
          <EmptyState title="No stock items" hint='Add tyres, diesel, oil… with "Add Stock Item".' />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Item</th>
                  <th className={TH}>Type</th>
                  <th className={`${TH} text-right`}>In Stock</th>
                  <th className={`${TH} text-right`}>Alert At</th>
                  <th className={`${TH} text-right`}>Avg Rate</th>
                  <th className={`${TH} text-right`}>Value</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {list.map((item) => {
                  const low = item.minStock > 0 && item.stockQty <= item.minStock;
                  return (
                    <tr key={item._id} className="tbl-row cursor-pointer" onClick={() => setEditingItem(item)}>
                      <td className={TD}>
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        {item.notes && <p className="truncate text-xs text-slate-500">{item.notes}</p>}
                      </td>
                      <td className={TD}>{getInventoryCategoryLabel(item.category)}</td>
                      <td className={`${TD} whitespace-nowrap text-right font-semibold ${low || item.stockQty <= 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                        {formatNumber(item.stockQty)} {item.unit}
                        {low && <span className="badge-red ml-1.5">Low</span>}
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right text-slate-500`}>{item.minStock > 0 ? `${formatNumber(item.minStock)} ${item.unit}` : '—'}</td>
                      <td className={`${TD} whitespace-nowrap text-right`}>{formatRupees(item.avgRate)}</td>
                      <td className={`${TD} whitespace-nowrap text-right font-semibold`}>{formatRupees(Math.max(0, item.stockQty) * item.avgRate)}</td>
                      <td className={TD} onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end">
                          <RowAction title="Buy (add stock)" icon={ArrowDownToLine} tone="emerald" onClick={() => setBuying({ itemId: item._id })} />
                          <RowAction title="Issue to vehicle" icon={ArrowUpFromLine} tone="amber" onClick={() => setIssuing({ type: 'issue', itemId: item._id })} />
                          <RowAction title="Edit" icon={Pencil} onClick={() => setEditingItem(item)} />
                          <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => handleDelete(item)} />
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

      {editingItem && <ItemPopup item={editingItem._id ? editingItem : null} onClose={() => setEditingItem(null)} onSaved={refresh} />}
      {buying && <PurchasePopup items={everyItem} preset={buying} onClose={() => setBuying(null)} onSaved={refresh} onItemAdded={reloadAll} />}
      {issuing && <TxnPopup items={everyItem} preset={issuing} onClose={() => setIssuing(null)} onSaved={refresh} />}
    </Page>
  );
}
