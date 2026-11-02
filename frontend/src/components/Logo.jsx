import { Truck } from 'lucide-react';

export default function Logo({ subtitle }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-700 to-primary-500 text-white shadow-lg shadow-primary-700/20">
        <Truck size={22} />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-lg font-bold leading-tight text-slate-900">TransportBook</span>
        {subtitle && <span className="block max-w-[160px] truncate text-[11px] font-medium text-slate-500">{subtitle}</span>}
      </span>
    </span>
  );
}
