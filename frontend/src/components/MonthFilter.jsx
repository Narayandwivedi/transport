import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonth } from '../utils/format';

const shift = (month, by) => {
  const [year, mon] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + by, 1));
  return date.toISOString().slice(0, 7);
};

// ‹ October 2026 › — pick the month a list or report covers
export default function MonthFilter({ value, onChange }) {
  return (
    <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
      <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-800" onClick={() => onChange(shift(value, -1))} aria-label="Previous month">
        <ChevronLeft size={16} />
      </button>
      <label className="relative cursor-pointer px-2 text-xs font-semibold text-slate-700 md:text-sm">
        {formatMonth(value)}
        <input type="month" className="absolute inset-0 cursor-pointer opacity-0" value={value} onChange={(event) => event.target.value && onChange(event.target.value)} />
      </label>
      <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-800" onClick={() => onChange(shift(value, 1))} aria-label="Next month">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
