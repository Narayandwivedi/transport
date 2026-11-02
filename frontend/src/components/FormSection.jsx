import { Plus } from 'lucide-react';

const TONES = {
  blue: { box: 'from-blue-50 to-sky-50 border-blue-200', badge: 'bg-blue-600' },
  sky: { box: 'from-sky-50 to-cyan-50 border-sky-200', badge: 'bg-sky-600' },
  emerald: { box: 'from-emerald-50 to-teal-50 border-emerald-200', badge: 'bg-emerald-600' },
  amber: { box: 'from-amber-50 to-orange-50 border-amber-200', badge: 'bg-amber-500' },
  indigo: { box: 'from-indigo-50 to-blue-50 border-indigo-200', badge: 'bg-indigo-600' },
  rose: { box: 'from-rose-50 to-orange-50 border-rose-200', badge: 'bg-rose-500' },
  slate: { box: 'from-slate-50 to-blue-50 border-slate-300', badge: 'bg-slate-600' }
};

/**
 * Numbered, lightly tinted block that groups related fields inside a FormPopup.
 * hint: one short line under the title. action: something for the right of the title, e.g. a show / hide button.
 */
export default function FormSection({ number, title, hint, tone = 'blue', action, children }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <section className={`rounded-xl border-2 bg-gradient-to-r p-3 md:p-5 ${t.box}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-800 md:text-base">
          {number !== undefined && (
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-white md:h-7 md:w-7 md:text-sm ${t.badge}`}>{number}</span>
          )}
          <span className="truncate">{title}</span>
        </h3>
        {action}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {children && <div className="mt-3 space-y-3 md:mt-4 md:space-y-4">{children}</div>}
    </section>
  );
}

// Small "+ Add" link for a field label, e.g. to add a new party without leaving the form
export function AddLink({ onClick, children = 'Add' }) {
  return (
    <button type="button" onClick={onClick} className="flex cursor-pointer items-center gap-0.5 text-xs font-semibold text-primary-600 hover:text-primary-800 hover:underline">
      <Plus size={14} /> {children}
    </button>
  );
}

// Grid of fields inside a section: 1 column on phones, `cols` from tablet up
const GRID_COLS = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 md:grid-cols-3', 4: 'sm:grid-cols-2 md:grid-cols-4' };
export function FieldGrid({ cols = 2, className = '', children }) {
  return <div className={`grid grid-cols-1 gap-3 md:gap-4 ${GRID_COLS[cols] || GRID_COLS[2]} ${className}`}>{children}</div>;
}
