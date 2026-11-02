import { useState } from 'react';
import { CalendarX2, FileBadge, FileWarning, Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import useMasters from '../utils/useMasters';
import { useAlerts } from '../context/AlertsContext';
import { daysLeftText, formatDate, idOf } from '../utils/format';
import { DOCUMENT_TYPE_OPTIONS } from '../utils/constants';
import StatCard from '../components/StatCard';
import Segmented from '../components/Segmented';
import DocumentPopup from '../components/DocumentPopup';
import DocumentTable from '../components/DocumentTable';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, TD, TH } from '../components/ui';

// Columns of the overview: the documents every goods vehicle needs
const MAIN_TYPES = ['tax', 'insurance', 'fitness', 'puc', 'gps', 'permit'];

const CELL_TONE = {
  expired: 'bg-rose-50 text-rose-700 ring-rose-200',
  due_soon: 'bg-amber-50 text-amber-700 ring-amber-200',
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export default function Documents() {
  const [view, setView] = useState('overview');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);
  const { vehicles } = useMasters();
  const { reload: reloadAlerts } = useAlerts();
  const { data: docs, loading, error, reload } = useFetch('/documents', {}, []);

  const all = docs || [];
  const current = all.filter((doc) => doc.status !== 'renewed');
  const count = (key) => current.filter((doc) => doc.status === key).length;
  const list = all.filter((doc) => !status || doc.status === status);

  // Latest document of each type for each vehicle
  const latest = new Map(current.map((doc) => [`${idOf(doc.vehicleId)}:${doc.docType}`, doc]));

  const refresh = () => {
    reload();
    reloadAlerts();
  };

  const handleDelete = async (doc) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await apiClient.delete(`/documents/${doc._id}`);
      toast.success('Document deleted');
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const renew = (doc) => setEditing({ preset: { vehicleId: idOf(doc.vehicleId), docType: doc.docType, provider: doc.provider } });

  return (
    <Page>
      <PageHeader title="Documents" subtitle="Road tax, insurance, fitness, PUC, GPS and permits, with automatic expiry alerts">
        <button type="button" className="btn-primary" onClick={() => setEditing({})}><Plus size={18} /> Add Document</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={FileBadge} tone="indigo" label="Documents" value={current.length} />
        <StatCard compact icon={CalendarX2} tone="rose" label="Expired" value={count('expired')} />
        <StatCard compact icon={FileWarning} tone="amber" label="Expiring Soon" value={count('due_soon')} hint="Change the days in Settings" />
        <StatCard compact icon={ShieldCheck} tone="emerald" label="Valid" value={count('ok')} />
      </section>

      <Segmented value={view} onChange={setView} options={[{ key: 'overview', label: 'Vehicle Overview' }, { key: 'list', label: 'All Documents' }]} />

      {loading && !all.length ? <Loading /> : view === 'overview' ? (
        <section className="panel">
          <PanelHeader title="Expiry by Vehicle" onRefresh={refresh} loading={loading} />
          {vehicles.length === 0 ? <EmptyState title="Add a vehicle first" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr>
                    <th className={TH}>Vehicle</th>
                    {MAIN_TYPES.map((type) => <th key={type} className={TH}>{DOCUMENT_TYPE_OPTIONS.find((option) => option.value === type).label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {vehicles.filter((vehicle) => vehicle.status !== 'sold').map((vehicle) => (
                    <tr key={vehicle._id} className="tbl-row">
                      <td className={`${TD} whitespace-nowrap font-mono font-semibold`}>{vehicle.vehicleNo}</td>
                      {MAIN_TYPES.map((type) => {
                        const doc = latest.get(`${vehicle._id}:${type}`);
                        return (
                          <td key={type} className="px-2 py-2">
                            {doc ? (
                              <button
                                type="button"
                                onClick={() => (doc.status === 'ok' ? setEditing(doc) : renew(doc))}
                                title={doc.status === 'ok' ? 'Edit' : 'Renew'}
                                className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ring-1 transition hover:brightness-95 ${CELL_TONE[doc.status]}`}
                              >
                                <span className="block font-semibold">{formatDate(doc.expiryDate)}</span>
                                <span className="block text-[11px]">{daysLeftText(doc.daysLeft)}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditing({ preset: { vehicleId: vehicle._id, docType: type } })}
                                className="w-full rounded-lg border border-dashed border-slate-300 px-2 py-2.5 text-xs font-semibold text-slate-400 hover:border-primary-400 hover:text-primary-600"
                              >
                                + Add
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="panel">
          <PanelHeader title="All Documents" count={list.length} onRefresh={refresh} loading={loading}>
            <Segmented value={status} onChange={setStatus} options={[{ key: '', label: 'All' }, { key: 'expired', label: 'Expired' }, { key: 'due_soon', label: 'Expiring' }, { key: 'ok', label: 'Valid' }, { key: 'renewed', label: 'Old' }]} />
          </PanelHeader>
          {list.length === 0 ? <EmptyState title="No documents" /> : (
            <DocumentTable docs={list} onEdit={setEditing} onRenew={renew} onDelete={handleDelete} />
          )}
        </section>
      )}

      {editing && (
        <DocumentPopup
          doc={editing._id ? editing : null}
          preset={editing.preset || {}}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </Page>
  );
}
