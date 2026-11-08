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

// The basic lines each card shows; "All details" opens every line
const KEY_LINES = {
  trip: ['Date', 'Vehicle', 'Route', 'Transport', 'Paid Now', 'Balance Due'],
  diesel: ['Date', 'Vehicle', 'Litres', 'Rate', 'Paid Now', 'Due to Pump'],
  payment: ['Date', 'Party', 'Mode', 'Reference'],
  reading: ['Date', 'Vehicle', 'Opening', 'Closing', 'Run'],
  expense: ['Date', 'Vehicle', 'Expense Type', 'Paid To', 'Mode'],
};
// Shorter labels on the card
const SHORT = { 'Paid Now': 'Paid', 'Balance Due': 'Balance', 'Due to Pump': 'Balance', 'Expense Type': 'Type' };
const rupeeValue = (text) => Number(String(text).replace(/[^0-9.]/g, '')) || 0;

// The basic lines of an entry, leaving out what the card already shows on top (the total)
const basicLines = (entity, details = [], amount = 0) => (KEY_LINES[entity] || [])
  .map((label) => details.find((row) => row.label === label))
  .filter((row) => row && !(row.label === 'Transport' && rupeeValue(row.value) === Number(amount)));

const isDue = (row) => ['Balance Due', 'Due to Pump'].includes(row.label) && rupeeValue(row.value) > 0;

const Fact = ({ row }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{SHORT[row.label] || row.label}</dt>
    <dd className={`break-words text-[13px] leading-snug ${isDue(row) ? 'font-semibold text-rose-700' : 'font-medium text-slate-800'}`}>{row.value}</dd>
  </div>
);

/** The basic facts of an entry as small label-over-value cells, in one row on a wide screen. */
const FactGrid = ({ rows }) => (rows.length > 0 && (
  <dl className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6">
    {rows.map((row) => <Fact key={row.label} row={row} />)}
  </dl>
));

/** Card shell: icon, title and tags, who and when, the amount on the right; body and footer from the caller. */
function EntryCard({ entity, title, tags, meta, amount, amountLabel = 'Amount', action, children, footer }) {
  return (
    <article className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <header className="flex items-start gap-3 px-4 pt-3 pb-2">
        <EntryIcon entity={entity} title={title} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
            {tags}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">{meta}</p>
        </div>
        {(amount > 0 || action) && (
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            {amount > 0 && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{amountLabel}</p>
                <p className="text-base font-bold leading-tight text-slate-900">{formatRupees(amount)}</p>
              </div>
            )}
            {action}
          </div>
        )}
      </header>
      {children && <div className="px-4 pb-3 pl-16">{children}</div>}
      {footer && <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2">{footer}</footer>}
    </article>
  );
}

const DetailsLink = ({ onClick }) => (
  <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900" onClick={onClick}>
    <Eye size={14} /> All details
  </button>
);

/** One waiting entry: what it is, its main facts (or for a change, only what changed), and the buttons. */
function WaitingCard({ change, busy, onView, onReject, onApprove }) {
  const isEdit = change.action === 'update';
  const details = change.details || [];
  const facts = basicLines(change.entity, details, change.summary?.amount);

  const beforeOf = new Map((change.beforeDetails || []).map((row) => [row.label, row.value]));
  const changed = isEdit && change.beforeDetails
    ? [
      ...details.filter((row) => beforeOf.get(row.label) !== row.value).map((row) => ({ label: row.label, before: beforeOf.get(row.label) || '', after: row.value })),
      ...(change.beforeDetails || []).filter((row) => !details.some((d) => d.label === row.label)).map((row) => ({ label: row.label, before: row.value, after: '' })),
    ]
    : [];

  return (
    <EntryCard
      entity={change.entity}
      title={change.summary?.title}
      tags={<span className={isEdit ? 'badge-orange' : 'badge-green'}>{isEdit ? 'Change' : 'New'}</span>}
      meta={<><span>Sent by</span><ByChip by={{ kind: 'staff', name: change.staffName }} /><span>· {formatDate(change.createdAt)}, {timeOf(change.createdAt)}</span></>}
      amount={change.summary?.amount}
      amountLabel={change.entity === 'trip' ? 'Total Bill' : 'Amount'}
      footer={(
        <>
          <DetailsLink onClick={onView} />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary btn-sm text-rose-700" onClick={onReject} disabled={Boolean(busy)}><X size={15} /> Reject</button>
            <button type="button" className="btn-primary btn-sm" onClick={onApprove} disabled={Boolean(busy)}><Check size={15} /> {busy === change.id ? 'Saving…' : 'Approve'}</button>
          </div>
        </>
      )}
    >
      {change.targetMissing ? (
        <p className="text-sm text-amber-700">The entry this change was for has been deleted.</p>
      ) : isEdit && change.beforeDetails ? (
        changed.length === 0 ? <p className="text-sm text-slate-500">No visible changes.</p> : (
          <div className="space-y-2">
            {changed.map((row) => (
              <div key={row.label} className="grid grid-cols-[7rem_1fr] items-baseline gap-3 text-sm">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{row.label}</span>
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <span className="break-words text-slate-400 line-through">{row.before || '—'}</span>
                  <ArrowRight size={13} className="shrink-0 self-center text-amber-600" />
                  <span className="break-words font-semibold text-slate-900">{row.after || '—'}</span>
                </span>
              </div>
            ))}
          </div>
        )
      ) : facts.length ? (
        <FactGrid rows={facts} />
      ) : (
        change.summary?.detail && <p className="text-sm text-slate-600">{change.summary.detail}</p>
      )}
    </EntryCard>
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
        <div className="space-y-3 bg-slate-50/60 p-3 sm:p-4">
          {rows.map((change) => (
            <WaitingCard
              key={change.id}
              change={change}
              busy={busy}
              onView={() => setViewing(change)}
              onReject={() => reject(change)}
              onApprove={() => approve(change)}
            />
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
          <div className="space-y-3 p-3 sm:p-4">
            {group.rows.map((row) => {
              const details = row.details || [];
              return (
                <EntryCard
                  key={`${row.entity}-${row.id}`}
                  entity={row.entity}
                  title={row.title}
                  tags={row.edited && <span className="badge-gray">Edited</span>}
                  meta={<><span>Added by</span><ByChip by={row.by} /><span>· {timeOf(row.createdAt)}</span></>}
                  amount={row.amount}
                  amountLabel={row.entity === 'trip' ? 'Total Bill' : 'Amount'}
                  action={<DetailsLink onClick={() => setViewing(row)} />}
                >
                  {details.length ? (
                    <FactGrid rows={basicLines(row.entity, details, row.amount)} />
                  ) : (
                    row.detail && <p className="text-sm text-slate-600">{row.detail}</p>
                  )}
                </EntryCard>
              );
            })}
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
