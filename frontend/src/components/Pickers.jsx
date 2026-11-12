import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { getCategoryLabel, getPartyTypeLabel } from '../utils/constants';
import { focusNextField } from '../utils/enterNav';

// "CG 04-AB 1234" and "cg04ab1234" match each other
const squash = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Dropdown with a search box. items: [{ value, label, tags, search }] in the order to show;
 * search is extra text that matches (a mobile number, a type). Arrow keys move, Enter picks, Esc closes.
 * mono: show the label in a fixed-width font (vehicle numbers).
 * openSignal: a number; each time it goes up the list opens (e.g. 1 to open when a popup opens, +1 to open it next).
 * hideSearch: the open list has no search box, only the options (scrolling when long). The field keeps the keys:
 * arrows move, Enter picks, Esc closes, and typing a few letters or digits jumps to the first match.
 * triggerClassName: extra classes for the field (e.g. a smaller one in a section header). ariaLabel: when no label points at it.
 * menuAlign: 'right' opens the list from the field's right edge (a field near the right side).
 * noDefaultPick: with nothing picked yet, the list opens with no row highlighted and Enter moves on without picking.
 * coverField: the open list sits in the field's place, so only the list shows (the field is back once it closes).
 * disabled: greyed out and cannot open. enterSubmit: the form's last field, where Enter saves (after picking).
 */
function SearchSelect({
  items, value, onChange, allowEmpty = false, emptyLabel, id, required = false, searchPlaceholder = 'Search', mono = false, openSignal = 0,
  hideSearch = false, triggerClassName = '', ariaLabel, menuAlign = 'left', noDefaultPick = false, coverField = false,
  disabled = false, enterSubmit = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const triggerRef = useRef(null);
  // hideSearch: what was typed in the last moment, to jump to the first option that matches it
  const typed = useRef({ text: '', at: 0 });

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
    // noDefaultPick: with nothing picked yet, no row is highlighted until an arrow key or typing
    setActive(index >= 0 ? index : noDefaultPick ? -1 : 0);
    // No search box: the cursor stays on the field, which takes the keys
    if (hideSearch) triggerRef.current?.focus();
    else searchRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Opened from outside: on the popup opening, or as the next field after another pick
  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

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
      // Enter picks the highlighted row instead of submitting the form; in an Enter-to-next form it then moves on
      event.preventDefault();
      // enterSubmit: the last field of an Enter-to-next form; Enter here saves the form (after the pick)
      const saveForm = () => triggerRef.current?.closest('form')?.requestSubmit();
      if (options[active]) {
        pick(options[active].value);
        setTimeout(() => {
          if (enterSubmit) {
            saveForm();
            return;
          }
          // Another list may have opened as the next field; leave the cursor there
          // (with no search box the cursor is still on this field, which also means it should move on)
          const focused = document.activeElement;
          const lost = !focused || focused === document.body || (hideSearch && focused === triggerRef.current);
          if (lost && !focusNextField(triggerRef.current)) triggerRef.current?.focus();
        }, 0);
      } else if (noDefaultPick) {
        // Nothing highlighted: like a plain dropdown, Enter leaves it as it is and moves on (or saves, on the last field)
        close();
        setTimeout(() => (enterSubmit ? saveForm() : focusNextField(triggerRef.current)), 0);
      }
    } else if (event.key === 'Escape') {
      // Esc closes this list, not the popup around it
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close();
    }
  };

  // hideSearch: typing jumps to the first option whose name, tags or extra search text has what was typed
  const jumpTo = (key) => {
    const now = Date.now();
    const text = (now - typed.current.at < 800 ? typed.current.text : '') + key;
    typed.current = { text, at: now };
    const needle = squash(text);
    const index = options.findIndex((option) => !option.empty && squash(`${option.label} ${option.tags || ''} ${option.search || ''}`).includes(needle));
    if (index >= 0) setActive(index);
  };

  const labelClass = mono ? 'font-mono font-semibold text-slate-900' : 'font-semibold text-slate-900';

  return (
    <div ref={boxRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        data-enter-submit={enterSubmit ? '' : undefined}
        // coverField: see-through while open (not hidden, so it keeps the cursor and the arrow keys); the list covers it
        className={`input flex items-center justify-between gap-2 text-left ${triggerClassName} ${coverField && open ? 'opacity-0' : ''}`}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setOpen(true);
          } else if (open && hideSearch) {
            if (event.key.length === 1 && /[a-z0-9]/i.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
              event.preventDefault();
              jumpTo(event.key);
            } else {
              onSearchKey(event);
            }
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
        <div className={`absolute z-50 min-w-[14rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl ${coverField ? 'top-0' : 'mt-1'} ${menuAlign === 'right' ? 'right-0' : 'left-0 right-0'}`}>
          {!hideSearch && (
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
          )}
          <ul ref={listRef} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 && <li className="px-3 py-3 text-center text-sm text-slate-500">{query ? <>Nothing matches &ldquo;{query}&rdquo;</> : 'Nothing to pick yet'}</li>}
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
// hideSearch: see SearchSelect (the Add Trip form's dropdowns)
export function VehicleSelect({ vehicles, value, onChange, allowEmpty = false, emptyLabel = 'Select vehicle', id, required = false, includeSold = false, openSignal = 0, hideSearch = false, coverField = false }) {
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
      openSignal={openSignal}
      hideSearch={hideSearch}
      coverField={coverField}
    />
  );
}

// Party dropdown with search by name or mobile; the preferred types are listed first
export function PartySelect({ parties, value, onChange, prefer = [], allowEmpty = false, emptyLabel = 'Select party', id, required = false, openSignal = 0, hideSearch = false, coverField = false }) {
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
      openSignal={openSignal}
      hideSearch={hideSearch}
      coverField={coverField}
    />
  );
}

// Driver dropdown with search, like the vehicle one: "Ramesh · CG04AB1234"; type part of the name, mobile or vehicle no.
// coverField: see SearchSelect (Add Trip: the open list shows in the field's place)
export function DriverSelect({ drivers, value, onChange, allowEmpty = true, emptyLabel = 'Select driver', id, openSignal = 0, hideSearch = false, coverField = false }) {
  const items = useMemo(
    () => drivers.map((driver) => ({
      value: driver._id,
      label: driver.name,
      tags: [driver.vehicleId?.vehicleNo, driver.isActive ? '' : 'Left'].filter(Boolean).join(' · '),
      search: `${driver.mobile || ''} ${driver.vehicleId?.vehicleNo || ''}`,
    })),
    [drivers],
  );
  return (
    <SearchSelect
      items={items}
      value={value}
      onChange={onChange}
      allowEmpty={allowEmpty}
      emptyLabel={emptyLabel}
      id={id}
      searchPlaceholder="Search driver name or vehicle no."
      openSignal={openSignal}
      hideSearch={hideSearch}
      coverField={coverField}
    />
  );
}

/**
 * A fixed list (charge type, payment mode, status…) in the same dropdown style as the pickers above,
 * with no search box: options [{ value, label, tags? }] (tags: small grey text after the label). allowEmpty: emptyLabel
 * is a choice of its own (value ''); otherwise it is only shown until something is picked.
 */
export function OptionSelect({
  options, value, onChange, allowEmpty = false, emptyLabel = 'Select', id, required = false, openSignal = 0, triggerClassName = '', ariaLabel, menuAlign, coverField = false,
  disabled = false, enterSubmit = false,
}) {
  return (
    <SearchSelect
      items={options}
      value={value}
      // Like a plain dropdown: picking what is already picked changes nothing
      onChange={(next) => {
        if (next !== (value ?? '')) onChange(next);
      }}
      allowEmpty={allowEmpty}
      emptyLabel={emptyLabel}
      id={id}
      required={required}
      openSignal={openSignal}
      hideSearch
      noDefaultPick
      triggerClassName={triggerClassName}
      ariaLabel={ariaLabel}
      menuAlign={menuAlign}
      coverField={coverField}
      disabled={disabled}
      enterSubmit={enterSubmit}
    />
  );
}
