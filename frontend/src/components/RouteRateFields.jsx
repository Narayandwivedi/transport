import { ArrowRight, Plus, Trash2 } from 'lucide-react';

const ROUTE_BASIS_OPTIONS = [
  { value: 'per_trip', label: 'Per Trip', unit: 'trip' },
  { value: 'per_km', label: 'Per KM', unit: 'km' },
  { value: 'per_ton', label: 'Per Ton', unit: 'ton' },
];

const unitOf = (basis) => ROUTE_BASIS_OPTIONS.find((option) => option.value === basis)?.unit || 'trip';

const EMPTY_ROUTE = { from: '', to: '', basis: 'per_trip', rate: '', hireRate: '', distanceKm: '' };

const toTitleCase = (value) => String(value || '')
  .toLowerCase()
  .replace(/\b[a-z]/g, (char) => char.toUpperCase());

// ₹ box with the unit after it: "₹ 5000  /trip"
const RateInput = ({ value, onChange, unit, placeholder, label }) => (
  <div className="relative">
    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-400">₹</span>
    <input className="input pl-7 pr-12" type="number" min="0" step="any" value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} />
    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-400">/{unit}</span>
  </div>
);

/**
 * A vehicle's agreed route rates, one card per route: From → To, how the party is charged
 * (per trip, per km or per ton) and the rate, the owner's rate on a hired vehicle, and the route length.
 * onChange gets the new list.
 */
export default function RouteRateFields({ routes, isHired, onChange }) {
  const rows = routes?.length ? routes : [];

  const updateRow = (index, field, value) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const addRow = () => {
    onChange([...rows, { ...EMPTY_ROUTE }]);
    // Focus the new row's From once it has rendered
    requestAnimationFrame(() => document.getElementById(`route-from-${rows.length}`)?.focus());
  };

  return (
    <div>
      <div className="space-y-2">
        {rows.map((row, index) => {
          const basis = row.basis || 'per_trip';
          const unit = unitOf(basis);
          return (
            <div key={index} className="space-y-2 rounded-lg bg-white p-2.5 ring-1 ring-emerald-200">
              <div className="grid grid-cols-[1fr_auto_1fr_2rem] items-center gap-2">
                <input
                  id={`route-from-${index}`}
                  className="input"
                  value={row.from}
                  onChange={(event) => updateRow(index, 'from', toTitleCase(event.target.value))}
                  placeholder="From, e.g. Raipur"
                  autoComplete="off"
                />
                <ArrowRight size={16} className="text-slate-400" />
                <input
                  className="input"
                  value={row.to}
                  onChange={(event) => updateRow(index, 'to', toTitleCase(event.target.value))}
                  placeholder="To, e.g. Bilaspur"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                  aria-label="Remove route"
                  className="flex h-9 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className={`grid grid-cols-2 gap-2 ${isHired ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                <select className="input" value={basis} onChange={(event) => updateRow(index, 'basis', event.target.value)} aria-label="Charge party">
                  {ROUTE_BASIS_OPTIONS.map((option) => <option key={option.value} value={option.value}>Charge {option.label}</option>)}
                </select>
                <RateInput value={row.rate} onChange={(value) => updateRow(index, 'rate', value)} unit={unit} placeholder="Party rate" label="Party rate" />
                {isHired && <RateInput value={row.hireRate} onChange={(value) => updateRow(index, 'hireRate', value)} unit={unit} placeholder="Owner rate" label="Pay owner rate" />}
                <div className="relative">
                  <input className="input pr-10" type="number" min="0" step="any" value={row.distanceKm ?? ''} onChange={(event) => updateRow(index, 'distanceKm', event.target.value)} placeholder={basis === 'per_km' ? 'Distance' : 'Distance (optional)'} aria-label="Route distance" />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-400">km</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={addRow} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline">
        <Plus size={14} /> Add Route
      </button>
    </div>
  );
}
