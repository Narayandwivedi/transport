import { Inbox, RefreshCw, Search } from 'lucide-react';

export const TH = 'tbl-head px-3 py-2 first:pl-5 last:pr-5';
export const TD = 'tbl-cell px-3 py-2 first:pl-5 last:pr-5';

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header gap-2.5">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Page({ children }) {
  return <div className="page-fade-in space-y-3.5 px-3 pb-6 pt-3.5 md:space-y-4 lg:px-6 lg:pt-4">{children}</div>;
}

export function Loading({ text = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary-600 border-r-transparent" />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', hint = '', icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={20} />
      </span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700">{message}</div>;
}

// Panel header row: title + count on the left, search / filters / refresh on the right
export function PanelHeader({ title, count, search, onSearch, searchPlaceholder = 'Search', onRefresh, loading, children }) {
  return (
    <div className="panel-header flex flex-wrap items-center justify-between gap-2.5 py-2.5">
      <h2 className="text-sm font-bold text-slate-800">
        {title} {count !== undefined && <span className="ml-1 font-medium text-slate-400">{count}</span>}
      </h2>
      <div className="flex min-w-0 flex-1 basis-56 flex-wrap items-center justify-end gap-2">
        {children}
        {onSearch && (
          <div className="relative min-w-0 flex-1 md:max-w-64">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" className="input pl-9" value={search} onChange={(event) => onSearch(event.target.value)} placeholder={searchPlaceholder} />
          </div>
        )}
        {onRefresh && (
          <button type="button" className="icon-btn shrink-0" title="Refresh" aria-label="Refresh" onClick={onRefresh}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
      </div>
    </div>
  );
}

// Label + control in one block
// A labelled form field. required: shows a red * after the label. action: a small link at the label's right (e.g. "+ Add").
export function Field({ label, htmlFor, hint, required = false, action, className = '', children }) {
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="label mb-0" htmlFor={htmlFor}>
            {label}{required && <span className="text-red-500"> *</span>}
          </label>
          {action}
        </div>
      )}
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

// Number box with a ₹ before it, or a unit after it
export function MoneyInput({ value, onChange, prefix = '₹', suffix = '', ...rest }) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-400">{prefix}</span>}
      <input
        type="number"
        step="any"
        min="0"
        className={`input ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-14' : ''}`}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        onWheel={(event) => event.currentTarget.blur()}
        placeholder="0"
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-400">{suffix}</span>}
    </div>
  );
}

// Edit / delete style icon button in a table row
export function RowAction({ title, icon: Icon, tone = 'blue', onClick }) {
  const tones = {
    blue: 'hover:bg-blue-50 hover:text-blue-600',
    rose: 'hover:bg-rose-50 hover:text-rose-600',
    emerald: 'hover:bg-emerald-50 hover:text-emerald-600',
    amber: 'hover:bg-amber-50 hover:text-amber-600',
  };
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`icon-btn p-1.5 ${tones[tone]}`}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
    >
      <Icon size={16} />
    </button>
  );
}

export function Badge({ className = 'badge-gray', children }) {
  return <span className={className}>{children}</span>;
}
