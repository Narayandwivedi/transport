import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { getCategoryLabel, getPartyTypeLabel } from '../utils/constants';

// "CG 04-AB 1234" and "cg04ab1234" match each other
const squash = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Dropdown with a search box. items: [{ value, label, tags, search }] in the order to show;
 * search is extra text that matches (a mobile number, a type). Arrow keys move, Enter picks, Esc closes.
 * mono: show the label in a fixed-width font (vehicle numbers).
 */
function SearchSelect({ items, value, onChange, allowEmpty = false, emptyLabel, id, required = false, searchPlaceholder = 'Search', mono = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const selected = items.find((item) => item.value === value) || null;

  // The empty choice (when allowed) first, then what matches the search
  const options = useMemo(() => {
    const needle = squash(query);
    const matches = items.filter((item) => !needle || squash(`${item.label} ${item.tags || ''} ${item.search || ''}`).includes(needle));
    return allowEmpty && !needle ? [{ value: '', label: emptyLabel, empty: true }, ...matches] : matches;
  }, [items, query, allowEmpty, emptyLabel]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (next) => {
    onChange(next);
    close();
  };

  // Opening: start on the picked item and put the cursor in the search box
  useEffect(() => {
    if (!open) return;
    const index = options.findIndex((option) => option.value === (value || ''));
    setActive(index >= 0 ? index : 0);
    searchRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A click anywhere else closes it
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (!boxRef.current?.contains(event.target)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted row in view
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onSearchKey = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      // Enter picks the highlighted row instead of submitting the form
      event.preventDefault();
      if (options[active]) pick(options[active].value);
    } else if (event.key === 'Escape') {
      // Esc closes this list, not the popup around it
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close();
    }
  };

  const labelClass = mono ? 'font-mono font-semibold text-slate-900' : 'font-semibold text-slate-900';

  return (
    <div ref={boxRef} className="relative">
      <button
        id={id}
        type="button"
        className="input flex items-center justify-between gap-2 text-left"
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className={`truncate ${labelClass}`}>{selected.label}</span>
            {selected.tags && <span className="shrink-0 truncate text-xs text-slate-500">{selected.tags}</span>}
          </span>
        ) : (
          <span className={allowEmpty ? 'truncate text-slate-700' : 'truncate text-slate-400'}>{emptyLabel}</span>
        )}
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Lets the form's own "required" check stop a save with nothing picked */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
          value={value || ''}
          onChange={() => {}}
          required
        />
      )}

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 min-w-[14rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="relative border-b border-slate-100 p-2">
            <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              className="w-full rounded-md bg-slate-50 py-1.5 pl-7 pr-2 text-sm text-slate-800 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-primary-500"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKey}
              placeholder={searchPlaceholder}
              autoComplete="off"
            />
          </div>
          <ul ref={listRef} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 && <li className="px-3 py-3 text-center text-sm text-slate-500">Nothing matches &ldquo;{query}&rdquo;</li>}
            {options.map((option, index) => {
              const isPicked = option.value === (value || '');
              return (
                <li
                  key={option.value || 'empty'}
                  role="option"
                  aria-selected={isPicked}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(option.value)}
                  className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${index === active ? 'bg-primary-50' : ''}`}
                >
                  {option.empty ? (
                    <span className="text-slate-600">{option.label}</span>
                  ) : (
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className={`truncate ${labelClass}`}>{option.label}</span>
                      {option.tags && <span className="shrink-0 truncate text-xs text-slate-500">{option.tags}</span>}
                    </span>
                  )}
                  {isPicked && <Check size={14} className="shrink-0 text-primary-600" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

const vehicleTags = (vehicle) => `${getCategoryLabel(vehicle.category)}${vehicle.ownership === 'hired' ? ' · Hired' : ''}${vehicle.status === 'sold' ? ' · Sold' : ''}`;

// Vehicle dropdown with search: "CG04AB1234 · Truck · Hired"; type part of the number or the type
export function VehicleSelect({ vehicles, value, onChange, allowEmpty = false, emptyLabel = 'Select vehicle', id, required = false, includeSold = false }) {
  const items = useMemo(
    () => vehicles
      .filter((vehicle) => includeSold || vehicle.status !== 'sold' || vehicle._id === value)
      .map((vehicle) => ({ value: vehicle._id, label: vehicle.vehicleNo, tags: vehicleTags(vehicle) })),
    [vehicles, includeSold, value],
  );
  return (
    <SearchSelect
      items={items}
      value={value}
      onChange={onChange}
      allowEmpty={allowEmpty}
      emptyLabel={emptyLabel}
      id={id}
      required={required}
      searchPlaceholder="Search vehicle no."
      mono
    />
  );
}

// Party dropdown with search by name or mobile; the preferred types are listed first
export function PartySelect({ parties, value, onChange, prefer = [], allowEmpty = false, emptyLabel = 'Select party', id, required = false }) {
  const items = useMemo(() => {
    const rank = (party) => (prefer.includes(party.type) ? 0 : 1);
    return [...parties]
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
      .map((party) => ({ value: party._id, label: party.name, tags: getPartyTypeLabel(party.type), search: party.mobile }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parties, prefer.join(',')]);
  return (
    <SearchSelect
      items={items}
      value={value}
      onChange={onChange}
      allowEmpty={allowEmpty}
      emptyLabel={emptyLabel}
      id={id}
      required={required}
      searchPlaceholder="Search party name or mobile"
    />
  );
}
