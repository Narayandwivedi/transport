/**
 * Pill-in-a-track switcher used for tabs and quick filters. Smaller on phones.
 * options: [{ key, label, shortLabel?, icon? }] — shortLabel replaces label on phones.
 */
export default function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`scrollbar-hide inline-flex max-w-full self-start overflow-x-auto rounded-lg bg-slate-100 p-1 ${className}`}>
      {options.map(({ key, label, shortLabel, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-semibold transition md:px-3 md:py-1.5 md:text-sm ${
            value === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {Icon && <Icon className="h-3.5 w-3.5 md:h-[15px] md:w-[15px]" />}
          {shortLabel ? (
            <>
              <span className="md:hidden">{shortLabel}</span>
              <span className="hidden md:inline">{label}</span>
            </>
          ) : label}
        </button>
      ))}
    </div>
  );
}
