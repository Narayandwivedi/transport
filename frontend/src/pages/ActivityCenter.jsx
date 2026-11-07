import { useState } from 'react';
import { ArrowRight, Check, CheckCheck, Clock, Eye, History, ListChecks, RefreshCw, UserRound, X } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { useAlerts } from '../context/AlertsContext';
import { formatDate, formatRupees } from '../utils/format';
import { entityLook, groupByDay, timeOf } from '../utils/staff';
import Segmented from '../components/Segmented';
import EntryDetailPopup from '../components/EntryDetailPopup';
import { EmptyState, ErrorBox, Loading, Page, PageHeader } from '../components/ui';

const PERIODS = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 Days' },
  { days: 30, label: '30 Days' },
];

const EntryIcon = ({ entity, title }) => {
  const { icon: Icon, tone } = entityLook(entity, title);
  return <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${tone}`}><Icon size={17} /></span>;
};

// Opens the entry's full details
const ViewButton = ({ onClick }) => (
  <button type="button" className="btn-secondary btn-sm" onClick={onClick}><Eye size={15} /> View</button>
);

const ByChip = ({ by }) => (by?.kind === 'staff'
  ? <span className="badge-blue inline-flex items-center gap-1"><UserRound size={11} /> {by.name}</span>
  : <span className="badge-gray">Owner</span>);

function DayChips({ value, onChange }) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-0.5">
      {PERIODS.map((period) => (
        <button
          key={period.days}
          type="button"
          onClick={() => onChange(period.days)}
          aria-pressed={value === period.days}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${value === period.days ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}

/** Staff entries waiting for approval: approve to save them, reject with a reason. */
function Waiting({ onChanged }) {
  const { data, loading, error, reload } = useFetch('/activity/pending', {}, null);
  const [busy, setBusy] = useState('');
  const [viewing, setViewing] = useState(null);
  const rows = data || [];

  const after = () => {
    setViewing(null);
    reload();
    onChanged();
  };

  const approve = async (change) => {
    setBusy(change.id);
    try {
      await apiClient.post(`/activity/pending/${change.id}/approve`);
      toast.success(`${change.summary?.title || 'Entry'} approved and saved`);
      after();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const reject = async (change) => {
    const note = window.prompt(`Reject "${change.summary?.title}"? You can tell ${change.staffName} why (optional):`, '');
    if (note === null) return;
    setBusy(change.id);
    try {
      await apiClient.post(`/activity/pending/${change.id}/reject`, { note });
      toast.success('Rejected');
      after();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const approveAll = async () => {
    if (!window.confirm(`Approve and save all ${rows.length} waiting entries?`)) return;
    setBusy('all');
    try {
      const result = await apiClient.post('/activity/pending/approve-all');
      if (result.approved) toast.success(`${result.approved} approved and saved`);
      result.failed.forEach((row) => toast.error(`${row.title || 'Entry'}: ${row.message}`));
      after();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="panel">
      <div className="panel-header flex flex-wrap items-center justify-between gap-2 py-2.5">
        <h2 className="text-sm font-bold text-slate-800">Waiting for Approval <span className="ml-1 text-slate-400">{rows.length}</span></h2>
        <div className="flex items-center gap-2">
          {rows.length > 1 && (
            <button type="button" className="btn-primary btn-sm" onClick={approveAll} disabled={Boolean(busy)}><CheckCheck size={15} /> Approve All</button>
          )}
          <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={reload} aria-label="Refresh" title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      <ErrorBox message={error} />
      {loading && !data ? <Loading /> : rows.length === 0 ? (
        <EmptyState icon={ListChecks} title="Nothing waiting" hint="Entries your staff add with “save on approval” show here until you approve them." />
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((change) => (
            <div key={change.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <EntryIcon entity={change.entity} title={change.summary?.title} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={change.action === 'update' ? 'badge-orange' : 'badge-green'}>{change.action === 'update' ? 'Change' : 'New'}</span>
                    <p className="text-sm font-semibold text-slate-900">{change.summary?.title}</p>
                    {change.summary?.amount > 0 && <p className="text-sm font-bold text-slate-900">{formatRupees(change.summary.amount)}</p>}
                  </div>
                  {change.action === 'update' && change.before ? (
                    <div className="mt-1 space-y-0.5 text-xs">
                      <p className="text-slate-400 line-through">{[change.before.detail, change.before.amount ? formatRupees(change.before.amount) : ''].filter(Boolean).join(' · ')}</p>
                      <p className="flex items-start gap-1 text-slate-700"><ArrowRight size={12} className="mt-0.5 shrink-0" /> {[change.summary?.detail, change.summary?.amount ? formatRupees(change.summary.amount) : ''].filter(Boolean).join(' · ')}</p>
                    </div>
                  ) : (
                    change.summary?.detail && <p className="text-xs text-slate-500">{change.summary.detail}</p>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                    <ByChip by={{ kind: 'staff', name: change.staffName }} />
                    <span>sent {formatDate(change.createdAt)} {timeOf(change.createdAt)}</span>
                    {change.summary?.date && <span>· entry date {formatDate(change.summary.date)}</span>}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:pt-0.5">
                <ViewButton onClick={() => setViewing(change)} />
                <button type="button" className="btn-secondary btn-sm text-rose-700" onClick={() => reject(change)} disabled={Boolean(busy)}><X size={15} /> Reject</button>
                <button type="button" className="btn-primary btn-sm" onClick={() => approve(change)} disabled={Boolean(busy)}><Check size={15} /> {busy === change.id ? 'Saving…' : 'Approve'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {viewing && (
        <EntryDetailPopup
          changeId={viewing.id}
          busy={busy === viewing.id}
          onApprove={() => approve(viewing)}
          onReject={() => reject(viewing)}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}

/** Every entry saved in the period, with who added it. */
function AllEntries() {
  const [days, setDays] = useState(1);
  const [by, setBy] = useState('');
  const [viewing, setViewing] = useState(null);
  const { data, loading, error, reload } = useFetch('/activity/feed', { days, by }, null);
  const groups = groupByDay(data?.rows || []);

  return (
    <section className="panel">
      <div className="panel-header flex flex-wrap items-center justify-between gap-2 py-2.5">
        <h2 className="text-sm font-bold text-slate-800">All Entries <span className="ml-1 text-slate-400">{data?.rows?.length || 0}</span></h2>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input h-9 min-h-0 w-auto py-0 text-xs md:text-sm" value={by} onChange={(event) => setBy(event.target.value)} aria-label="Added by">
            <option value="">Everyone</option>
            <option value="owner">Owner</option>
            {(data?.staff || []).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          <DayChips value={days} onChange={setDays} />
          <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={reload} aria-label="Refresh" title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      <ErrorBox message={error} />
      {loading && !data ? <Loading /> : groups.length === 0 ? (
        <EmptyState icon={History} title="No entries in this period" hint="Trips, diesel, payments, meter readings and expenses show here as they are added." />
      ) : groups.map((group) => (
        <div key={group.label}>
          <p className="bg-slate-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">{group.label}</p>
          <div className="divide-y divide-slate-100">
            {group.rows.map((row) => (
              <div key={`${row.entity}-${row.id}`} className="flex items-start gap-3 px-4 py-3">
                <EntryIcon entity={row.entity} title={row.title} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                    {row.amount > 0 && <p className="text-sm font-bold text-slate-900">{formatRupees(row.amount)}</p>}
                  </div>
                  {row.detail && <p className="text-xs text-slate-500">{row.detail}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                    <ByChip by={row.by} />
                    <span>{timeOf(row.createdAt)}</span>
                    {row.date && <span>· entry date {formatDate(row.date)}</span>}
                    {row.edited && <span>· edited</span>}
                  </p>
                </div>
                <ViewButton onClick={() => setViewing(row)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {viewing && <EntryDetailPopup entity={viewing.entity} id={viewing.id} onClose={() => setViewing(null)} />}
    </section>
  );
}

/** What was approved or rejected. */
function Reviewed() {
  const [days, setDays] = useState(7);
  const [viewing, setViewing] = useState(null);
  const { data, loading, error, reload } = useFetch('/activity/reviewed', { days }, null);
  const rows = data || [];
  return (
    <section className="panel">
      <div className="panel-header flex flex-wrap items-center justify-between gap-2 py-2.5">
        <h2 className="text-sm font-bold text-slate-800">Reviewed <span className="ml-1 text-slate-400">{rows.length}</span></h2>
        <div className="flex items-center gap-2">
          <DayChips value={days} onChange={setDays} />
          <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={reload} aria-label="Refresh" title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      <ErrorBox message={error} />
      {loading && !data ? <Loading /> : rows.length === 0 ? (
        <EmptyState icon={History} title="Nothing reviewed in this period" />
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((change) => (
            <div key={change.id} className="flex items-start gap-3 px-4 py-3">
              <EntryIcon entity={change.entity} title={change.summary?.title} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={change.status === 'approved' ? 'badge-green' : 'badge-red'}>{change.status === 'approved' ? 'Approved' : 'Rejected'}</span>
                  <p className="text-sm font-semibold text-slate-900">{change.action === 'update' ? 'Change: ' : ''}{change.summary?.title}</p>
                  {change.summary?.amount > 0 && <p className="text-sm font-bold text-slate-900">{formatRupees(change.summary.amount)}</p>}
                </div>
                {change.summary?.detail && <p className="text-xs text-slate-500">{change.summary.detail}</p>}
                {change.reviewNote && <p className="mt-0.5 text-xs text-rose-700">Reason: {change.reviewNote}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                  <ByChip by={{ kind: 'staff', name: change.staffName }} />
                  <span>reviewed {formatDate(change.reviewedAt)} {timeOf(change.reviewedAt)}</span>
                </p>
              </div>
              <ViewButton onClick={() => setViewing(change)} />
            </div>
          ))}
        </div>
      )}
      {viewing && <EntryDetailPopup changeId={viewing.id} onClose={() => setViewing(null)} />}
    </section>
  );
}

/** Activity Center: approve staff entries, and see every entry with who added it. */
export default function ActivityCenter() {
  const { alerts, reload: reloadAlerts } = useAlerts();
  const waitingCount = alerts?.pendingApprovals || 0;
  const [tab, setTab] = useState('waiting');

  return (
    <Page>
      <PageHeader title="Activity Center" subtitle="Approve what your staff add, and see every entry with who added it" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: 'waiting', label: waitingCount ? `Waiting (${waitingCount})` : 'Waiting', icon: Clock },
          { key: 'all', label: 'All Entries', icon: History },
          { key: 'reviewed', label: 'Reviewed', icon: ListChecks },
        ]}
      />
      {tab === 'waiting' && <Waiting onChanged={reloadAlerts} />}
      {tab === 'all' && <AllEntries />}
      {tab === 'reviewed' && <Reviewed />}
    </Page>
  );
}
