import { ArrowRight, Clock, UserRound, X } from 'lucide-react';
import useFetch from '../utils/useFetch';
import { formatDate } from '../utils/format';
import { entityLook, timeOf } from '../utils/staff';
import FormPopup from './FormPopup';
import { ErrorBox, Loading } from './ui';

// "Ravi · 07 Nov 2026 2:45 pm"
const whenText = (name, at) => `${name} · ${formatDate(at)} ${timeOf(at)}`;

/**
 * Every field of an entry, from the Activity Center.
 * Saved entry: { entity, id }. Waiting or reviewed change: { changeId }; a change shows Before and After,
 * with the lines that differ marked. onApprove / onReject: buttons for a change still waiting.
 */
export default function EntryDetailPopup({ entity, id, changeId, onApprove, onReject, busy = false, onClose }) {
  const url = changeId ? `/activity/pending/${changeId}/view` : `/activity/view/${entity}/${id}`;
  const { data, loading, error } = useFetch(url, {}, null);

  const kind = changeId ? data?.entity : entity;
  const title = changeId ? data?.summary?.title : data?.title;
  const { icon: Icon, tone } = entityLook(kind, title || '');
  const isEdit = changeId && data?.action === 'update';
  const waiting = changeId && data?.status === 'pending';

  // Before / After lines side by side, by label
  const beforeOf = new Map((data?.beforeDetails || []).map((row) => [row.label, row.value]));
  const afterLabels = (data?.details || []).map((row) => row.label);
  const compareRows = isEdit
    ? [
      ...(data?.details || []).map((row) => ({ label: row.label, before: beforeOf.get(row.label) ?? '', after: row.value })),
      ...(data?.beforeDetails || []).filter((row) => !afterLabels.includes(row.label)).map((row) => ({ label: row.label, before: row.value, after: '' })),
    ]
    : [];
  const changedCount = compareRows.filter((row) => row.before !== row.after).length;

  const status = changeId && data ? ({
    pending: <span className="badge-orange inline-flex items-center gap-1"><Clock size={12} /> Waiting for approval</span>,
    approved: <span className="badge-green">Approved</span>,
    rejected: <span className="badge-red">Rejected</span>,
  })[data.status] : null;

  return (
    <FormPopup
      title={title || 'Entry'}
      subtitle={changeId ? (isEdit ? 'Change sent by staff' : 'New entry sent by staff') : 'Entry details'}
      maxWidth={isEdit ? 'max-w-3xl' : 'max-w-xl'}
      onClose={onClose}
      hideFooter={!waiting}
      submitLabel={busy ? 'Saving…' : 'Approve'}
      submitDisabled={busy}
      onSubmit={() => onApprove?.()}
      footerExtra={waiting && (
        <button type="button" className="btn-secondary btn-sm text-rose-700" onClick={() => onReject?.()} disabled={busy}><X size={15} /> Reject</button>
      )}
    >
      <ErrorBox message={error} />
      {loading && !data ? <Loading /> : data && (
        <>
          {/* Who and when */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600 ring-1 ring-slate-200">
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset ${tone}`}><Icon size={16} /></span>
            {changeId ? (
              <>
                <span className="badge-blue inline-flex items-center gap-1"><UserRound size={11} /> {data.staffName}</span>
                <span>sent {formatDate(data.createdAt)} {timeOf(data.createdAt)}</span>
                {status}
              </>
            ) : (
              <>
                {data.by?.kind === 'staff'
                  ? <span className="badge-blue inline-flex items-center gap-1"><UserRound size={11} /> {data.by.name}</span>
                  : <span className="badge-gray">Owner</span>}
                <span>added {formatDate(data.createdAt)} {timeOf(data.createdAt)}</span>
                {data.updatedBy && <span>· last changed by {whenText(data.updatedBy.kind === 'staff' ? data.updatedBy.name : 'Owner', data.updatedAt)}</span>}
              </>
            )}
          </div>

          {changeId && data.reviewNote && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-rose-200">Reason: {data.reviewNote}</p>}
          {data.targetMissing && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">The entry this change was for has been deleted.</p>}

          {isEdit && !data.targetMissing ? (
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <p className="bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{changedCount} line{changedCount === 1 ? '' : 's'} changed</p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="w-1/4 px-3 py-2" />
                    <th className="px-3 py-2">Before</th>
                    <th className="px-3 py-2">After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {compareRows.map((row) => {
                    const changed = row.before !== row.after;
                    return (
                      <tr key={row.label} className={changed ? 'bg-amber-50/70' : ''}>
                        <td className="px-3 py-2 text-xs font-semibold text-slate-500">{row.label}</td>
                        <td className={`px-3 py-2 ${changed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{row.before || '—'}</td>
                        <td className={`px-3 py-2 ${changed ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                          {changed && <ArrowRight size={12} className="mr-1 inline text-amber-600" />}{row.after || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <dl className="divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200">
              {(data.details || []).map((row) => (
                <div key={row.label} className="grid grid-cols-[8.5rem_1fr] gap-3 px-3 py-2 text-sm">
                  <dt className="text-xs font-semibold text-slate-500">{row.label}</dt>
                  <dd className={`min-w-0 break-words ${['Total Bill', 'Amount', 'Balance Due', 'Due to Pump'].includes(row.label) ? 'font-bold text-slate-900' : 'text-slate-800'}`}>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </FormPopup>
  );
}
