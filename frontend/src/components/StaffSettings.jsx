import { useState } from 'react';
import { Clock, Pencil, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { EDIT_MODES, STAFF_ENTRIES } from '../utils/staff';
import FormPopup from './FormPopup';
import FormSection from './FormSection';
import { EmptyState, Field, Loading, MoneyInput, RowAction } from './ui';

const allOn = () => Object.fromEntries(STAFF_ENTRIES.map((entry) => [entry.key, true]));

// A labelled on / off switch with a line explaining it
function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg bg-white px-3 py-2.5 ring-1 ring-slate-200">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary-600" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

/** Add or change a staff login and what it may do. */
function StaffPopup({ staff = null, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: staff?.name || '',
    mobile: staff?.mobile || '',
    password: '',
    canAdd: { ...allOn(), ...(staff?.canAdd || {}) },
    editMode: staff?.editMode || 'none',
    editDays: staff?.editDays ?? 5,
    seeOwnerEntries: staff?.seeOwnerEntries ?? false,
    needsApproval: staff?.needsApproval ?? true,
    isActive: staff?.isActive ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const setAdd = (key, value) => setForm((prev) => ({ ...prev, canAdd: { ...prev.canAdd, [key]: value } }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (staff && !payload.password) delete payload.password;
      if (staff) await apiClient.put(`/staff/${staff._id}`, payload);
      else await apiClient.post('/staff', payload);
      toast.success(staff ? 'Staff updated' : `Staff added. ${form.name} can sign in with ${form.mobile} on the Staff tab.`);
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPopup title={staff ? `Edit Staff · ${staff.name}` : 'Add Staff'} subtitle="A separate login that sees only the add buttons and its own entries" maxWidth="max-w-2xl" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving}>
      <FormSection number={1} title="Login" tone="blue" hint="Staff sign in on the Staff tab of the login page with this mobile and password.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Name" required htmlFor="staff-name">
            <input id="staff-name" className="input" value={form.name} onChange={(event) => set('name', event.target.value)} required autoFocus />
          </Field>
          <Field label="Mobile" required htmlFor="staff-mobile">
            <input
              id="staff-mobile"
              className="input font-mono"
              value={form.mobile}
              onChange={(event) => set('mobile', event.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
              maxLength={10}
              pattern="[0-9]{10}"
              title="Enter a 10-digit mobile number"
              placeholder="10 digits"
              required
            />
          </Field>
          <Field label={staff ? 'New Password' : 'Password'} required={!staff} htmlFor="staff-password" hint={staff ? 'Leave empty to keep it' : 'At least 4 characters'}>
            <input id="staff-password" className="input" value={form.password} onChange={(event) => set('password', event.target.value)} required={!staff} minLength={4} autoComplete="new-password" />
          </Field>
        </div>
      </FormSection>

      <FormSection number={2} title="Can Add" tone="emerald" hint="Only these buttons show for this staff.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STAFF_ENTRIES.map(({ key, label, icon: Icon }) => (
            <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ring-1 transition ${form.canAdd[key] ? 'bg-white text-slate-800 ring-emerald-300' : 'bg-slate-50 text-slate-400 ring-slate-200'}`}>
              <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={form.canAdd[key] !== false} onChange={(event) => setAdd(key, event.target.checked)} />
              <Icon size={15} /> {label}
            </label>
          ))}
        </div>
      </FormSection>

      <FormSection number={3} title="Editing" tone="amber" hint="Only entries they added themselves. They can never delete.">
        <div className="grid gap-2">
          {EDIT_MODES.map((mode) => (
            <label key={mode.value} className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 ring-1 transition ${form.editMode === mode.value ? 'bg-white ring-amber-400' : 'bg-white/60 ring-slate-200 hover:ring-slate-300'}`}>
              <input type="radio" name="staff-edit-mode" className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600" checked={form.editMode === mode.value} onChange={() => set('editMode', mode.value)} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{mode.label}</span>
                <span className="block text-[11px] text-slate-500">{mode.hint}</span>
              </span>
            </label>
          ))}
          {form.editMode === 'request_after_days' && (
            <Field label="Edit directly for entries up to" hint={`An entry older than ${form.editDays || 0} days needs your approval to change.`}>
              <div className="w-40"><MoneyInput prefix="" suffix="days" value={form.editDays} onChange={(value) => set('editDays', value)} /></div>
            </Field>
          )}
        </div>
      </FormSection>

      <FormSection number={4} title="Rights" tone="indigo">
        <div className="grid gap-2">
          <Toggle checked={form.needsApproval} onChange={(value) => set('needsApproval', value)} label="Save on approval" hint="New entries wait in the Activity Center until you approve them." />
          <Toggle checked={form.seeOwnerEntries} onChange={(value) => set('seeOwnerEntries', value)} label="See owner's entries" hint="Also see your entries (view only). Otherwise they see only their own." />
          {staff && <Toggle checked={form.isActive} onChange={(value) => set('isActive', value)} label="Login active" hint="Switch off to stop this login at once without deleting it." />}
        </div>
      </FormSection>
    </FormPopup>
  );
}

/** Settings → Staff: the account's staff logins. */
export default function StaffSettings() {
  const { data, loading, reload } = useFetch('/staff', {}, null);
  const [editing, setEditing] = useState(null);
  const rows = data || [];

  const remove = async (staff) => {
    if (!window.confirm(`Delete ${staff.name}'s login? Their saved entries stay; anything still waiting for approval is removed.`)) return;
    try {
      await apiClient.delete(`/staff/${staff._id}`);
      toast.success('Staff login deleted');
      reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const rightsText = (staff) => [
    staff.needsApproval ? 'Adds on approval' : 'Adds directly',
    {
      none: 'No editing',
      direct: 'Edits directly',
      request: 'Edits on request',
      request_after_days: `Edits directly up to ${staff.editDays ?? 5} days, older on request`,
    }[staff.editMode || 'none'],
    staff.seeOwnerEntries ? "Sees owner's entries" : '',
  ].filter(Boolean).join(' · ');

  const addsText = (staff) => {
    const allowed = STAFF_ENTRIES.filter((entry) => staff.canAdd?.[entry.key] !== false);
    if (allowed.length === STAFF_ENTRIES.length) return 'Can add everything';
    if (!allowed.length) return 'Cannot add anything';
    return `Adds: ${allowed.map((entry) => entry.label.replace('Add ', '')).join(', ')}`;
  };

  return (
    <section className="panel max-w-5xl">
      <div className="panel-header flex items-center justify-between py-2.5">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800"><UserCog size={16} /> Staff Logins</h2>
          <p className="text-xs text-slate-500">Staff sign in on the Staff tab. They see only the add buttons and their entries.</p>
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={() => setEditing({})}><Plus size={15} /> Add Staff</button>
      </div>
      {loading && !data ? <Loading /> : rows.length === 0 ? (
        <EmptyState icon={UserCog} title="No staff yet" hint="Add a staff login so your munshi or driver can enter trips, diesel and payments." />
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((staff) => (
            <div key={staff._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                  {staff.name}
                  <span className="font-mono text-xs font-normal text-slate-500">{staff.mobile}</span>
                  {!staff.isActive && <span className="badge-gray">Switched off</span>}
                  {staff.pendingCount > 0 && <span className="badge-orange inline-flex items-center gap-1"><Clock size={11} /> {staff.pendingCount} waiting</span>}
                </p>
                <p className="flex items-center gap-1 text-xs text-slate-500"><ShieldCheck size={12} /> {rightsText(staff)}</p>
                <p className="text-xs text-slate-500">{addsText(staff)}</p>
              </div>
              <div className="flex">
                <RowAction title="Edit" icon={Pencil} onClick={() => setEditing(staff)} />
                <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => remove(staff)} />
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <StaffPopup staff={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={reload} />}
    </section>
  );
}
