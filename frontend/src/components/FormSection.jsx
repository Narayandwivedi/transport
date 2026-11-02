const TONES = {
  blue: { box: 'from-blue-50 to-sky-50 border-blue-200', badge: 'bg-blue-600' },
  sky: { box: 'from-sky-50 to-cyan-50 border-sky-200', badge: 'bg-sky-600' },
  emerald: { box: 'from-emerald-50 to-teal-50 border-emerald-200', badge: 'bg-emerald-600' },
  amber: { box: 'from-amber-50 to-orange-50 border-amber-200', badge: 'bg-amber-500' },
  indigo: { box: 'from-indigo-50 to-blue-50 border-indigo-200', badge: 'bg-indigo-600' },
  slate: { box: 'from-slate-50 to-blue-50 border-slate-300', badge: 'bg-slate-600' }
};

/**
 * Numbered, lightly tinted block that groups related fields inside a FormPopup.
 * hint: one short line under the title. action: something for the right of the title, e.g. a show / hide button.
 */
export default function FormSection({ number, title, hint, tone = 'blue', action, children }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <section className={`rounded-xl border-2 bg-gradient-to-r p-3 md:p-4 ${t.box}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-800 md:text-base">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-white md:h-7 md:w-7 md:text-sm ${t.badge}`}>{number}</span>
          <span className="truncate">{title}</span>
        </h3>
        {action}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {children && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}
