import { Fuel, Gauge, HandCoins, Route, Send, Wallet } from 'lucide-react';

// The entries a staff login can be allowed to add (keys match the server's "can add" switches)
export const STAFF_ENTRIES = [
  { key: 'trip', label: 'Add Trip', icon: Route, tone: 'bg-blue-50 text-blue-700 ring-blue-100' },
  { key: 'diesel', label: 'Diesel Purchase', icon: Fuel, tone: 'bg-orange-50 text-orange-700 ring-orange-100' },
  { key: 'expense', label: 'Add Expense', icon: Wallet, tone: 'bg-rose-50 text-rose-700 ring-rose-100' },
  { key: 'received', label: 'Money Received', icon: HandCoins, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  { key: 'paid', label: 'Money Paid', icon: Send, tone: 'bg-amber-50 text-amber-700 ring-amber-100' },
  { key: 'reading', label: 'Meter Reading', icon: Gauge, tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
];

// How a staff login may change the entries it added
export const EDIT_MODES = [
  { value: 'none', label: 'No editing', hint: 'They cannot change an entry once added.' },
  { value: 'direct', label: 'Edit directly', hint: 'Changes save at once.' },
  { value: 'request', label: 'Edit on request', hint: 'Every change waits in the Activity Center for your approval.' },
  { value: 'request_after_days', label: 'Edit directly for recent entries, older on request', hint: 'Entries up to the days below save at once; older ones wait for approval.' },
];

// Whether changing this entry will wait for the owner (entryDate: the entry's own date)
export const editWaitsForOwner = (staff, entryDate) => {
  if (staff?.editMode === 'request') return true;
  if (staff?.editMode !== 'request_after_days' || !entryDate) return false;
  const today = new Date(new Date().toISOString().slice(0, 10));
  const day = new Date(String(entryDate).slice(0, 10));
  return Math.round((today - day) / 86400000) > Number(staff.editDays ?? 5);
};

// How each kind of entry looks in the Activity Center
const ENTITY_LOOK = {
  trip: { icon: Route, tone: 'bg-blue-50 text-blue-700 ring-blue-100' },
  diesel: { icon: Fuel, tone: 'bg-orange-50 text-orange-700 ring-orange-100' },
  payment: { icon: HandCoins, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  reading: { icon: Gauge, tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
  expense: { icon: Wallet, tone: 'bg-rose-50 text-rose-700 ring-rose-100' },
};
export const entityLook = (entity, title = '') => {
  if (entity === 'payment' && /paid/i.test(title)) return { icon: Send, tone: 'bg-amber-50 text-amber-700 ring-amber-100' };
  return ENTITY_LOOK[entity] || ENTITY_LOOK.trip;
};

// "2:45 pm"
export const timeOf = (value) => new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

// "Today", "Yesterday" or "05 Nov 2026" for the day something was entered (local time)
export const dayLabel = (value) => {
  const day = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Rows grouped by the day they were entered, newest day first
export const groupByDay = (rows, field = 'createdAt') => {
  const groups = [];
  rows.forEach((row) => {
    const label = dayLabel(row[field]);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  });
  return groups;
};
