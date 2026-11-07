import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Eye, Pencil, Plus, Trash2, Truck, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { formatRupees } from '../utils/format';
import { PARTY_TYPE_OPTIONS, getPartyTypeLabel } from '../utils/constants';
import StatCard from '../components/StatCard';
import Segmented from '../components/Segmented';
import PartyPopup from '../components/PartyPopup';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, RowAction, TD, TH } from '../components/ui';

const TYPE_BADGE = { customer: 'badge-blue', supplier: 'badge-green' };

export default function Parties() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [editing, setEditing] = useState(null);
  const { data: parties, loading, error, reload } = useFetch('/parties', { search }, []);
  const { data: balances, reload: reloadBalances } = useFetch('/reports/balances', {}, []);

  const balanceOf = useMemo(() => new Map((balances || []).map((row) => [row.partyId, row.balance])), [balances]);
  const shown = (parties || []).filter((party) => type === 'all' || party.type === type);
  const receivable = (balances || []).filter((row) => row.balance > 0).reduce((total, row) => total + row.balance, 0);
  const payable = (balances || []).filter((row) => row.balance < 0).reduce((total, row) => total - row.balance, 0);

  const refresh = () => {
    reload();
    reloadBalances();
  };

  const handleDelete = async (party) => {
    if (!window.confirm(`Delete ${party.name}?`)) return;
    try {
      await apiClient.delete(`/parties/${party._id}`);
      toast.success('Party deleted');
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const balanceCell = (party) => {
    const balance = balanceOf.get(party._id) || 0;
    if (!balance) return <span className="text-slate-400">Settled</span>;
    return balance > 0
      ? <span className="font-semibold text-emerald-700">{formatRupees(balance)} <span className="text-[11px] font-medium">to receive</span></span>
      : <span className="font-semibold text-rose-700">{formatRupees(-balance)} <span className="text-[11px] font-medium">to pay</span></span>;
  };

  return (
    <Page>
      <PageHeader title="Parties" subtitle="Customers I bill and suppliers I pay">
        <button type="button" className="btn-primary" onClick={() => setEditing({})}><Plus size={18} /> Add Party</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Users} tone="indigo" label="Customers" value={(parties || []).filter((party) => party.type === 'customer').length} hint={`${(parties || []).length} parties in all`} />
        <StatCard compact icon={Truck} tone="amber" label="Suppliers" value={(parties || []).filter((party) => party.type === 'supplier').length} hint="Vehicle owners, pumps, shops" />
        <StatCard compact icon={ArrowDownLeft} tone="emerald" label="To Receive" value={formatRupees(receivable)} hint="Parties owe me" />
        <StatCard compact icon={ArrowUpRight} tone="rose" label="To Pay" value={formatRupees(payable)} hint="I owe parties" />
      </section>

      <section className="panel">
        <PanelHeader title="All Parties" count={shown.length} search={search} onSearch={setSearch} searchPlaceholder="Search name or mobile" onRefresh={refresh} loading={loading}>
          <Segmented value={type} onChange={setType} options={[{ key: 'all', label: 'All' }, ...PARTY_TYPE_OPTIONS.map((option) => ({ key: option.value, label: option.label }))]} />
        </PanelHeader>
        {loading && !(parties || []).length ? <Loading /> : shown.length === 0 ? (
          <EmptyState title="No parties found" hint='Add a customer, vehicle owner or supplier with "Add Party".' />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Name</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Mobile</th>
                  <th className={TH}>Balance</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {shown.map((party) => (
                  <tr key={party._id} className="tbl-row cursor-pointer" onClick={() => navigate(`/parties/${party._id}`)}>
                    <td className={TD}>
                      <p className="font-semibold text-slate-800">{party.name}</p>
                      {party.address && <p className="text-xs text-slate-500">{party.address}</p>}
                    </td>
                    <td className={TD}><span className={TYPE_BADGE[party.type]}>{getPartyTypeLabel(party.type)}</span></td>
                    <td className={TD}>{party.mobile || '—'}</td>
                    <td className={TD}>{balanceCell(party)}</td>
                    <td className={`${TD} text-right`}>
                      <div className="flex justify-end">
                        <RowAction title="Ledger" icon={Eye} tone="emerald" onClick={() => navigate(`/parties/${party._id}`)} />
                        <RowAction title="Edit" icon={Pencil} onClick={() => setEditing(party)} />
                        <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => handleDelete(party)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <PartyPopup party={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={refresh} />}
    </Page>
  );
}
