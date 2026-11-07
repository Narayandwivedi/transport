import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LogOut, Pencil, RefreshCw, ShieldCheck, Undo2, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatRupees } from '../utils/format';
import { STAFF_ENTRIES, editWaitsForOwner, entityLook, groupByDay, timeOf } from '../utils/staff';
import Logo from '../components/Logo';
import TripPopup from '../components/TripPopup';
import DieselPopup from '../components/DieselPopup';
import ExpensePopup from '../components/ExpensePopup';
import PaymentPopup from '../components/PaymentPopup';
import { ReadingPopup } from './MeterReadings';
import { EmptyState, Loading } from '../components/ui';

const PERIODS = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 Days' },
  { days: 30, label: '30 Days' },
];

// One entry line: icon, what it is, details, amount
function EntryLine({ entity, title, detail, amount, date, children }) {
  const { icon: Icon, tone } = entityLook(entity, title);
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${tone}`}><Icon size={16} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {amount > 0 && <p className="text-sm font-bold text-slate-900">{formatRupees(amount)}</p>}
        </div>
        {detail && <p className="text-xs text-slate-500">{detail}</p>}
        {date && <p className="text-[11px] text-slate-400">Entry date {formatDate(date)}</p>}
        {children}
      </div>
    </div>
  );
}

/**
 * The whole app for a staff login: the add buttons the owner allowed, and their entries.
 * With "save on approval", what they add waits for the owner and shows here as waiting / rejected.
 */
export default function StaffHome() {
  const { user, staff, logout } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [popup, setPopup] = useState('');
  const [editing, setEditing] = useState(null);
  const { data, loading, reload } = useFetch('/activity/mine', { days }, null);

  const allowed = STAFF_ENTRIES.filter((entry) => staff?.canAdd?.[entry.key] !== false);
  const changes = data?.changes || [];
  const waiting = changes.filter((change) => change.status === 'pending');
  const rejected = changes.filter((change) => change.status === 'rejected');
  const groups = groupByDay(data?.rows || []);

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const withdraw = async (change) => {
    if (!window.confirm(`Take back "${change.summary?.title}"? The owner will not see it.`)) return;
    try {
      await apiClient.delete(`/activity/pending/${change.id}`);
      toast.success('Taken back');
      reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const closePopup = () => {
    setPopup('');
    setEditing(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Logo />
            <p className="mt-0.5 truncate text-xs text-slate-500">{user?.companyName || user?.name} · Staff: <b className="text-slate-700">{staff?.name}</b></p>
          </div>
          <button type="button" className="btn-secondary btn-sm shrink-0" onClick={signOut}><LogOut size={15} /> Sign Out</button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        {staff?.needsApproval && (
          <p className="flex items-start gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-xs text-indigo-800 ring-1 ring-indigo-200">
            <ShieldCheck size={15} className="mt-0.5 shrink-0" />
            What you add is checked by the owner first. It is saved once the owner approves it.
          </p>
        )}

        {/* Add buttons the owner allowed */}
        <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#1f2a3c] via-[#27374f] to-[#314866] shadow-sm">
          <p className="px-4 pt-3 text-sm font-bold text-white">Add Entry</p>
          {allowed.length === 0 ? (
            <p className="px-4 pb-4 pt-1 text-xs text-slate-300">The owner has not allowed any entries for you yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-6">
              {allowed.map(({ key, label, icon: Icon, tone }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPopup(key)}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-white px-1 py-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-50"
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ${tone}`}><Icon size={18} /></span>
                  <span className="text-[12px] font-semibold leading-tight text-slate-700">{label}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Waiting for the owner, and rejected */}
        {(waiting.length > 0 || rejected.length > 0) && (
          <section className="panel">
            <div className="panel-header py-2.5"><h2 className="text-sm font-bold text-slate-800">Sent to Owner</h2></div>
            <div className="divide-y divide-slate-100">
              {[...waiting, ...rejected].map((change) => (
                <EntryLine key={change.id} entity={change.entity} title={`${change.action === 'update' ? 'Change: ' : ''}${change.summary?.title || 'Entry'}`} detail={change.summary?.detail} amount={change.summary?.amount} date={change.summary?.date}>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {change.status === 'pending' ? (
                      <>
                        <span className="badge-orange inline-flex items-center gap-1"><Clock size={12} /> Waiting for approval</span>
                        <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-600" onClick={() => withdraw(change)}><Undo2 size={13} /> Take back</button>
                      </>
                    ) : (
                      <span className="badge-red inline-flex items-center gap-1"><XCircle size={12} /> Rejected{change.reviewNote ? `: ${change.reviewNote}` : ''}</span>
                    )}
                    <span className="text-[11px] text-slate-400">sent {timeOf(change.createdAt)}</span>
                  </div>
                </EntryLine>
              ))}
            </div>
          </section>
        )}

        {/* Saved entries: their own, and the owner's when allowed */}
        <section className="panel">
          <div className="panel-header flex flex-wrap items-center justify-between gap-2 py-2.5">
            <h2 className="text-sm font-bold text-slate-800">{staff?.seeOwnerEntries ? 'Entries' : 'My Entries'}</h2>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-slate-100 p-0.5">
                {PERIODS.map((period) => (
                  <button
                    key={period.days}
                    type="button"
                    onClick={() => setDays(period.days)}
                    aria-pressed={days === period.days}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${days === period.days ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
              <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={reload} aria-label="Refresh" title="Refresh">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          {loading && !data ? <Loading /> : groups.length === 0 ? (
            <EmptyState title="No entries yet" hint="Use the buttons above to add one." />
          ) : groups.map((group) => (
            <div key={group.label}>
              <p className="bg-slate-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">{group.label}</p>
              <div className="divide-y divide-slate-100">
                {group.rows.map((row) => (
                  <EntryLine key={`${row.entity}-${row.id}`} entity={row.entity} title={row.title} detail={row.detail} amount={row.amount} date={row.date}>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span>{row.mine ? 'Added by you' : `Added by ${row.by?.name || 'Owner'}`} · {timeOf(row.createdAt)}</span>
                      {row.edited && <span>· edited</span>}
                      {row.mine && staff?.editMode && staff.editMode !== 'none' && row.doc && (
                        <button type="button" className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:underline" onClick={() => setEditing(row)}>
                          <Pencil size={12} /> {editWaitsForOwner(staff, row.date) ? 'Request Edit' : 'Edit'}
                        </button>
                      )}
                    </div>
                  </EntryLine>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>

      {/* Adding */}
      {popup === 'trip' && <TripPopup onClose={closePopup} onSaved={reload} />}
      {popup === 'diesel' && <DieselPopup onClose={closePopup} onSaved={reload} />}
      {popup === 'expense' && <ExpensePopup onClose={closePopup} onSaved={reload} />}
      {(popup === 'received' || popup === 'paid') && <PaymentPopup preset={{ type: popup }} onClose={closePopup} onSaved={reload} />}
      {popup === 'reading' && <ReadingPopup onClose={closePopup} onSaved={reload} />}

      {/* Changing one of their own */}
      {editing?.entity === 'trip' && <TripPopup trip={editing.doc} onClose={closePopup} onSaved={reload} />}
      {editing?.entity === 'diesel' && <DieselPopup entry={editing.doc} onClose={closePopup} onSaved={reload} />}
      {editing?.entity === 'expense' && <ExpensePopup expense={editing.doc} onClose={closePopup} onSaved={reload} />}
      {editing?.entity === 'payment' && <PaymentPopup payment={editing.doc} onClose={closePopup} onSaved={reload} />}
      {editing?.entity === 'reading' && <ReadingPopup reading={editing.doc} onClose={closePopup} onSaved={reload} />}
    </div>
  );
}
