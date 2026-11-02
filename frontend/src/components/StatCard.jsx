const TONES = {
  blue: { card: 'from-blue-50 to-sky-50 border-blue-200', icon: 'bg-blue-600', value: 'text-blue-700' },
  emerald: { card: 'from-emerald-50 to-teal-50 border-emerald-200', icon: 'bg-emerald-600', value: 'text-emerald-700' },
  teal: { card: 'from-teal-50 to-cyan-50 border-teal-200', icon: 'bg-teal-600', value: 'text-teal-700' },
  indigo: { card: 'from-indigo-50 to-violet-50 border-indigo-200', icon: 'bg-indigo-600', value: 'text-indigo-700' },
  amber: { card: 'from-amber-50 to-orange-50 border-amber-200', icon: 'bg-amber-500', value: 'text-amber-700' },
  rose: { card: 'from-rose-50 to-pink-50 border-rose-200', icon: 'bg-rose-600', value: 'text-rose-700' },
  slate: { card: 'from-slate-50 to-gray-50 border-slate-200', icon: 'bg-slate-600', value: 'text-slate-800' },
};

/**
 * Tinted summary tile: round icon, big value, label and an optional hint.
 * compact: smaller on phones so three tiles fit in one row (no hint there); slightly tighter than normal from md up.
 */
export default function StatCard({ icon: Icon, label, value, hint, tone = 'blue', compact = false }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <div className={`rounded-xl border-2 bg-gradient-to-r ${compact ? 'p-2 md:px-3.5 md:py-3' : 'p-3 md:px-4 md:py-4'} ${t.card}`}>
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
        {Icon && (
          <span className={`flex shrink-0 items-center justify-center rounded-full text-white ${compact ? 'h-7 w-7 md:h-10 md:w-10' : 'h-9 w-9 md:h-11 md:w-11'} ${t.icon}`}>
            <Icon className={compact ? 'h-4 w-4 md:h-5 md:w-5' : 'h-5 w-5'} />
          </span>
        )}
        <div className="min-w-0">
          <p className={`truncate font-bold leading-tight ${compact ? 'text-sm md:text-[22px]' : 'text-xl md:text-2xl'} ${t.value}`} title={typeof value === 'string' ? value : undefined}>{value}</p>
          <p className={`mt-0.5 font-semibold text-slate-700 md:text-sm ${compact ? 'text-[11px] leading-tight' : 'text-xs'}`}>{label}</p>
          {hint && <p className={`truncate text-[11px] text-slate-500 md:text-xs ${compact ? 'hidden md:block' : ''}`}>{hint}</p>}
        </div>
      </div>
    </div>
  );
}
