import { useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, BookOpen, Building2, CalendarClock, CalendarRange, ChevronRight, CircleDot, Download,
  ExternalLink, Fuel, Gauge, HandCoins, IndianRupee, Printer, Receipt, Route, Scale, TrendingUp, Truck, Wallet, X,
} from 'lucide-react';
import useFetch from '../utils/useFetch';
import { currentMonthInput, formatDate, formatMonth, formatNumber, formatRupees, monthBounds, todayInput, toNumber } from '../utils/format';
import { PAYMENT_MODE_OPTIONS, getPartyTypeLabel } from '../utils/constants';
import StatCard from '../components/StatCard';
import { VehicleSelect } from '../components/Pickers';
import MonthFilter from '../components/MonthFilter';
import Segmented from '../components/Segmented';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader } from '../components/ui';

/* ───────────── shared pieces ───────────── */

const rupees = (value) => (value ? formatRupees(value) : '—');
const litres = (value) => `${formatNumber(value)} ltr`;

/**
 * Period for a report: a month (‹ Nov 2026 ›) or a custom from–to range.
 * value: { month } or { from, to }; params() gives what the report endpoints take.
 */
function PeriodPicker({ value, onChange }) {
  const custom = Boolean(value.from);
  const startCustom = () => {
    const { from, to } = monthBounds(value.month || currentMonthInput());
    onChange({ from, to: to > todayInput() ? todayInput() : to });
  };
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {custom ? (
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 p-1 text-xs">
          <input type="date" className="rounded-md border-0 bg-white px-2 py-1 text-xs font-semibold text-slate-700" value={value.from} max={value.to} onChange={(event) => event.target.value && onChange({ ...value, from: event.target.value })} aria-label="From" />
          <span className="text-slate-400">to</span>
          <input type="date" className="rounded-md border-0 bg-white px-2 py-1 text-xs font-semibold text-slate-700" value={value.to} min={value.from} onChange={(event) => event.target.value && onChange({ ...value, to: event.target.value })} aria-label="To" />
          <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-white" onClick={() => onChange({ month: currentMonthInput() })} title="Back to month" aria-label="Back to month"><X size={14} /></button>
        </div>
      ) : (
        <>
          <MonthFilter value={value.month} onChange={(month) => onChange({ month })} />
          <button type="button" className="btn-secondary btn-sm" onClick={startCustom}><CalendarRange size={15} /> Dates</button>
        </>
      )}
    </div>
  );
}
const periodParams = (period) => (period.from ? { from: period.from, to: period.to } : { month: period.month });
const periodText = (period) => (period.from ? `${formatDate(period.from)} – ${formatDate(period.to)}` : formatMonth(period.month));

// Thin bar for a row's share of the biggest row
const Share = ({ value, max, tone = 'bg-blue-500' }) => (
  <span className="mt-1 block h-1 w-full max-w-28 overflow-hidden rounded-full bg-slate-100">
    <span className={`block h-full rounded-full ${tone}`} style={{ width: `${max ? Math.max(3, (value / max) * 100) : 0}%` }} />
  </span>
);

/**
 * A report table. Desktop: a normal table with a totals row. Phone: one compact row per entry —
 * the `main` column on the left, the `primary` column on the right, the rest as a small line below.
 * columns: [{ key, label, render(row), total?, align?, main?, primary?, phoneHide?, phoneOnly? }]
 */
function ReportTable({ columns, rows, totals, rowKey, onRowClick, selected, empty }) {
  if (!rows.length) return <EmptyState title={empty || 'Nothing in this period'} />;
  const mainCol = columns.find((col) => col.main) || columns[0];
  const primaryCol = columns.find((col) => col.primary);
  const others = columns.filter((col) => col !== mainCol && col !== primaryCol && !col.phoneHide);
  // phoneOnly: a column for the phone's right side only (e.g. one signed amount in place of two desktop columns)
  const desktopCols = columns.filter((col) => !col.phoneOnly);
  const th = 'px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 first:pl-4 last:pr-4';
  const td = 'px-3 py-2.5 first:pl-4 last:pr-4';
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>{desktopCols.map((col) => <th key={col.key} className={`${th} ${col.align === 'right' ? 'text-right' : 'text-left'}`}>{col.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`${onRowClick ? 'cursor-pointer' : ''} ${selected === key ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'}`}
                >
                  {desktopCols.map((col) => <td key={col.key} className={`${td} ${col.align === 'right' ? 'text-right tabular-nums' : ''} whitespace-nowrap`}>{col.render(row)}</td>)}
                </tr>
              );
            })}
          </tbody>
          {totals && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
              <tr>{desktopCols.map((col, index) => <td key={col.key} className={`${td} ${col.align === 'right' ? 'text-right tabular-nums' : ''} whitespace-nowrap`}>{index === 0 ? 'Total' : col.total ? col.total(totals) : ''}</td>)}</tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {rows.map((row) => {
          const key = rowKey(row);
          const Tag = onRowClick ? 'button' : 'div';
          return (
            <Tag
              key={key}
              type={onRowClick ? 'button' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`block w-full px-3 py-2.5 text-left ${selected === key ? 'bg-blue-50/70' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] font-semibold text-slate-900">{mainCol.render(row)}</span>
                {primaryCol && <span className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900">{primaryCol.render(row)}</span>}
              </div>
              {others.length > 0 && (
                <p className="mt-0.5 flex flex-wrap gap-x-2.5 text-[11px] text-slate-500">
                  {others.map((col) => <span key={col.key}>{col.label} <span className="font-semibold text-slate-700">{col.phoneText ? col.phoneText(row) : col.render(row)}</span></span>)}
                </p>
              )}
            </Tag>
          );
        })}
        {totals && (
          <div className="flex items-baseline justify-between bg-slate-50 px-3 py-2.5 text-[13px] font-bold text-slate-900">
            <span>Total</span>
            {primaryCol?.total && <span className="tabular-nums">{primaryCol.total(totals)}</span>}
          </div>
        )}
      </div>
    </>
  );
}

const Due = ({ value }) => (value > 0 ? <span className="font-semibold text-rose-700">{formatRupees(value)}</span> : <span className="text-slate-400">₹0</span>);

/** Downloads the table inside `root` as a CSV file: the rows on screen, with the totals row. */
const downloadTableCsv = (root, name) => {
  const table = root?.querySelector('table');
  if (!table) return;
  const cell = (element) => `"${element.textContent.replace(/\s+/g, ' ').trim().replace(/"/g, '""')}"`;
  const lines = [...table.querySelectorAll('tr')].map((row) => [...row.children].map(cell).join(','));
  // The BOM lets Excel read ₹ and other characters correctly
  const url = URL.createObjectURL(new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}-${todayInput()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
const ExportButton = ({ targetRef, name }) => (
  <button type="button" className="btn-secondary btn-sm no-print" onClick={() => downloadTableCsv(targetRef.current, name)} title="Download as CSV (opens in Excel)">
    <Download size={14} /> CSV
  </button>
);

/** A report block. search/onSearch: a search box in its header. exportName: a CSV download of its table. */
function Panel({ title, count, hint, children, actions, search, onSearch, searchPlaceholder, exportName }) {
  const ref = useRef(null);
  return (
    <section className="panel" ref={ref}>
      <PanelHeader title={title} count={count} search={search} onSearch={onSearch} searchPlaceholder={searchPlaceholder}>
        {actions}
        {exportName && <ExportButton targetRef={ref} name={exportName} />}
      </PanelHeader>
      {children}
      {hint && <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 md:text-xs">{hint}</p>}
    </section>
  );
}

// Matches a search box: any of the values contains the typed text
const matches = (query, ...values) => !query || values.some((value) => String(value || '').toLowerCase().includes(query));

/* ───────────── Diesel ───────────── */

function DieselReport({ period }) {
  // The vehicle filter goes to the server, so the cards, tables and totals are all for that vehicle
  const [vehicleId, setVehicleId] = useState('');
  const { data, loading, error } = useFetch('/reports/diesel', { ...periodParams(period), ...(vehicleId ? { vehicleId } : {}) }, null);
  const { data: vehicleList } = useFetch('/vehicles', {}, []);
  const [search, setSearch] = useState('');
  const vehicles = Array.isArray(vehicleList) ? vehicleList : [];
  const chosenNo = vehicles.find((item) => item._id === vehicleId)?.vehicleNo || '';

  const filter = (
    <section className="no-print flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-72">
        <VehicleSelect vehicles={vehicles} value={vehicleId} onChange={setVehicleId} allowEmpty emptyLabel="All Vehicles" includeSold id="diesel-vehicle" />
      </div>
      {vehicleId && <button type="button" className="btn-secondary btn-sm" onClick={() => setVehicleId('')}><X size={14} /> Clear Filter</button>}
      {loading && data && <span className="text-xs text-slate-400">Updating…</span>}
    </section>
  );

  if (loading && !data) return <>{filter}<Loading /></>;
  if (!data) return <>{filter}<ErrorBox message={error} /></>;
  const { totals, byVehicle, byPump, entries } = data;
  const maxLitres = Math.max(...byVehicle.map((row) => row.litres), 0);
  const query = search.trim().toLowerCase();
  const shown = entries.filter((row) => matches(query, row.vehicleNo, row.pump, row.tripNo, row.entryNo));
  // Totals of the entries listed (all of the vehicle's, or what the search leaves)
  const shownTotals = {
    litres: shown.reduce((sum, row) => sum + toNumber(row.litres), 0),
    amount: shown.reduce((sum, row) => sum + toNumber(row.amount), 0),
    due: shown.reduce((sum, row) => sum + Math.max(0, toNumber(row.amount) - toNumber(row.paid)), 0),
  };

  return (
    <>
      {filter}
      <ErrorBox message={error} />
      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Fuel} tone="amber" label="Diesel Issued" value={litres(totals.litres)} hint={`${totals.fills} fills`} />
        <StatCard compact icon={IndianRupee} tone="rose" label="Diesel Cost" value={formatRupees(totals.amount)} hint={`Paid ${formatRupees(totals.paid)}`} />
        <StatCard compact icon={Gauge} tone="blue" label="Average Rate" value={totals.avgRate ? `${formatRupees(totals.avgRate)}/ltr` : '—'} hint="Cost ÷ litres" />
        <StatCard compact icon={Scale} tone={totals.due > 0 ? 'rose' : 'slate'} label="Due to Pumps" value={formatRupees(totals.due)} hint="Not paid at the pump" />
      </section>

      <Panel title="Diesel Issued to Each Vehicle" count={byVehicle.length} hint="Tap a vehicle to see its diesel entries below." exportName="diesel-by-vehicle">
        <ReportTable
          rows={byVehicle}
          rowKey={(row) => row.vehicleId}
          selected={vehicleId}
          onRowClick={(row) => setVehicleId(row.vehicleId === vehicleId ? '' : row.vehicleId)}
          totals={totals}
          empty="No diesel filled in this period"
          columns={[
            { key: 'vehicle', label: 'Vehicle', main: true, render: (row) => <span className="font-mono font-semibold text-slate-800">{row.vehicleNo}</span> },
            { key: 'fills', label: 'Fills', align: 'right', render: (row) => row.fills, total: (t) => t.fills },
            {
              key: 'litres',
              label: 'Litres',
              align: 'right',
              render: (row) => <span className="inline-flex flex-col items-end font-semibold">{litres(row.litres)}<Share value={row.litres} max={maxLitres} tone="bg-amber-500" /></span>,
              phoneText: (row) => litres(row.litres),
              total: (t) => litres(t.litres),
            },
            { key: 'rate', label: 'Avg Rate', align: 'right', render: (row) => (row.avgRate ? `${formatRupees(row.avgRate)}` : '—') },
            { key: 'amount', label: 'Amount', align: 'right', primary: true, render: (row) => formatRupees(row.amount), total: (t) => formatRupees(t.amount) },
            { key: 'paid', label: 'Paid', align: 'right', render: (row) => rupees(row.paid), total: (t) => rupees(t.paid) },
            { key: 'due', label: 'Due', align: 'right', render: (row) => <Due value={row.due} />, total: (t) => <Due value={t.due} /> },
          ]}
        />
      </Panel>

      <Panel title="Diesel by Petrol Pump" count={byPump.length} exportName="diesel-by-pump">
        <ReportTable
          rows={byPump}
          rowKey={(row) => row.partyId || 'none'}
          totals={totals}
          columns={[
            {
              key: 'pump',
              label: 'Petrol Pump',
              main: true,
              render: (row) => (row.partyId
                ? <Link to={`/parties/${row.partyId}`} className="font-semibold text-blue-700 hover:underline" onClick={(event) => event.stopPropagation()}>{row.name}</Link>
                : <span className="text-slate-500">{row.name}</span>),
            },
            { key: 'fills', label: 'Fills', align: 'right', render: (row) => row.fills, total: (t) => t.fills },
            { key: 'litres', label: 'Litres', align: 'right', render: (row) => litres(row.litres), total: (t) => litres(t.litres) },
            { key: 'amount', label: 'Amount', align: 'right', primary: true, render: (row) => formatRupees(row.amount), total: (t) => formatRupees(t.amount) },
            { key: 'paid', label: 'Paid', align: 'right', render: (row) => rupees(row.paid), total: (t) => rupees(t.paid) },
            { key: 'due', label: 'Due', align: 'right', render: (row) => <Due value={row.due} />, total: (t) => <Due value={t.due} /> },
          ]}
        />
      </Panel>

      <Panel
        title={vehicleId ? `Diesel Entries · ${chosenNo}` : 'All Diesel Entries'}
        count={shown.length}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search vehicle, pump, trip"
        exportName="diesel-entries"
        actions={vehicleId && <button type="button" className="btn-secondary btn-sm no-print" onClick={() => setVehicleId('')}><X size={14} /> All vehicles</button>}
      >
        <ReportTable
          rows={shown}
          rowKey={(row) => row.id}
          totals={shownTotals}
          empty={vehicleId ? 'No diesel for this vehicle in this period' : 'No diesel filled in this period'}
          columns={[
            { key: 'date', label: 'Date', main: true, render: (row) => <span><span className="font-semibold text-slate-800">{formatDate(row.date)}</span><span className="ml-2 font-mono text-[11px] text-slate-400">{row.entryNo}</span></span> },
            { key: 'vehicle', label: 'Vehicle', render: (row) => <span className="font-mono">{row.vehicleNo}</span> },
            { key: 'pump', label: 'Pump', render: (row) => row.pump || '—', phoneHide: true },
            { key: 'trip', label: 'Trip', render: (row) => (row.tripNo ? <span className="font-mono">{row.tripNo}</span> : '—'), phoneText: (row) => row.tripNo || '—' },
            { key: 'litres', label: 'Litres', align: 'right', render: (row) => litres(row.litres), total: (t) => litres(t.litres) },
            { key: 'rate', label: 'Rate', align: 'right', render: (row) => formatRupees(row.rate), total: (t) => (t.litres ? formatRupees(t.amount / t.litres) : '—') },
            { key: 'amount', label: 'Amount', align: 'right', primary: true, render: (row) => formatRupees(row.amount), total: (t) => formatRupees(t.amount) },
            { key: 'due', label: 'Due', align: 'right', render: (row) => <Due value={Math.max(0, row.amount - row.paid)} />, total: (t) => <Due value={t.due} /> },
          ]}
        />
      </Panel>
    </>
  );
}

/* ───────────── Party Ledger ───────────── */

const balanceText = (balance) => {
  if (!balance) return 'Settled';
  return balance > 0 ? `${formatRupees(balance)} Dr` : `${formatRupees(-balance)} Cr`;
};

function PartyLedgerReport({ partyId, onParty }) {
  const { data: balances, loading, error } = useFetch('/reports/balances', {}, null);
  const [search, setSearch] = useState('');
  const [side, setSide] = useState('all');
  const rows = useMemo(() => (balances || [])
    .filter((row) => (side === 'all' ? true : side === 'owe_me' ? row.balance > 0 : side === 'i_owe' ? row.balance < 0 : !row.balance))
    .filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)), [balances, search, side]);

  if (loading && !balances) return <Loading />;
  const receivable = (balances || []).filter((row) => row.balance > 0).reduce((sum, row) => sum + row.balance, 0);
  const payable = (balances || []).filter((row) => row.balance < 0).reduce((sum, row) => sum - row.balance, 0);

  return (
    <>
      <ErrorBox message={error} />
      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-3">
        <StatCard compact icon={ArrowDownLeft} tone="emerald" label="They owe me" value={formatRupees(receivable)} hint={`${(balances || []).filter((row) => row.balance > 0).length} parties`} />
        <StatCard compact icon={ArrowUpRight} tone="rose" label="I owe them" value={formatRupees(payable)} hint={`${(balances || []).filter((row) => row.balance < 0).length} parties`} />
        <StatCard compact icon={Scale} tone="blue" label="Net" value={formatRupees(receivable - payable)} hint="To receive minus to pay" />
      </section>

      <div className={`grid gap-3 ${partyId ? 'lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]' : ''}`}>
        <section className={`panel ${partyId ? 'hidden lg:block' : ''}`}>
          <PanelHeader title="Party Balances" count={rows.length} search={search} onSearch={setSearch} searchPlaceholder="Search party" />
          <div className="border-b border-slate-100 px-3 py-2">
            <Segmented
              value={side}
              onChange={setSide}
              options={[
                { key: 'all', label: 'All' },
                { key: 'owe_me', label: 'They owe me' },
                { key: 'i_owe', label: 'I owe them' },
                { key: 'settled', label: 'Settled' },
              ]}
            />
          </div>
          {rows.length === 0 ? <EmptyState title="No parties" /> : (
            <div className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
              {rows.map((row) => (
                <button
                  key={row.partyId}
                  type="button"
                  onClick={() => onParty(row.partyId)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${row.partyId === partyId ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-slate-900 md:text-sm">{row.name}</span>
                    <span className="block text-[11px] text-slate-500">{getPartyTypeLabel(row.type)}</span>
                  </span>
                  <span className={`shrink-0 text-right text-[13px] font-bold tabular-nums md:text-sm ${row.balance > 0 ? 'text-emerald-700' : row.balance < 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                    {row.balance ? formatRupees(Math.abs(row.balance)) : 'Settled'}
                    {row.balance !== 0 && <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">{row.balance > 0 ? 'owes me' : 'I owe'}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {partyId && <LedgerPanel partyId={partyId} onClose={() => onParty('')} />}
      </div>
      {!partyId && <p className="text-center text-xs text-slate-500">Pick a party to see its ledger.</p>}
    </>
  );
}

/** One party's ledger; from–to narrows the rows and brings the earlier balance forward as the opening. */
function LedgerPanel({ partyId, onClose }) {
  const ref = useRef(null);
  const { data, loading, error } = useFetch(`/reports/party-ledger/${partyId}`, {}, null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  if (loading && !data) return <section className="panel"><Loading /></section>;
  if (!data) return <section className="panel"><ErrorBox message={error || 'Party not found'} /></section>;

  const { party } = data;
  const day = (value) => String(value).slice(0, 10);
  const before = from ? data.rows.filter((row) => day(row.date) < from) : [];
  const opening = before.length ? before[before.length - 1].balance : data.openingBalance;
  const rows = data.rows.filter((row) => (!from || day(row.date) >= from) && (!to || day(row.date) <= to));
  const debit = rows.reduce((sum, row) => sum + row.debit, 0);
  const credit = rows.reduce((sum, row) => sum + row.credit, 0);
  const closing = rows.length ? rows[rows.length - 1].balance : opening;
  const th = 'px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 first:pl-4 last:pr-4';
  const td = 'px-3 py-2 first:pl-4 last:pr-4';

  return (
    <section className="panel min-w-0" ref={ref}>
      <div className="panel-header flex flex-wrap items-start justify-between gap-2 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-slate-900 md:text-base">{party.name}</h2>
          <p className="text-[11px] text-slate-500 md:text-xs">{getPartyTypeLabel(party.type)}{party.mobile ? ` · ${party.mobile}` : ''}</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-1.5">
          <input type="date" className="input h-8 min-h-0 w-auto py-0 text-xs" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
          <input type="date" className="input h-8 min-h-0 w-auto py-0 text-xs" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} aria-label="To" />
          {(from || to) && <button type="button" className="icon-btn" onClick={() => { setFrom(''); setTo(''); }} title="All dates" aria-label="All dates"><X size={15} /></button>}
          {rows.length > 0 && <ExportButton targetRef={ref} name={`ledger-${party.name}`} />}
          <Link to={`/parties/${partyId}`} className="btn-secondary btn-sm"><ExternalLink size={14} /> Open</Link>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}><X size={14} /> Close</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-slate-100 text-center sm:grid-cols-4">
        {[
          ['Opening', balanceText(opening), 'text-slate-800'],
          ['Debit', formatRupees(debit), 'text-blue-700'],
          ['Credit', formatRupees(credit), 'text-amber-700'],
          ['Closing', balanceText(closing), closing > 0 ? 'text-emerald-700' : closing < 0 ? 'text-rose-700' : 'text-slate-500'],
        ].map(([label, value, tone]) => (
          <div key={label} className="bg-white px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`text-[13px] font-bold tabular-nums md:text-sm ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? <EmptyState title="No entries in these dates" /> : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-y border-slate-200 bg-slate-50">
                <tr>
                  <th className={`${th} text-left`}>Date</th>
                  <th className={`${th} text-left`}>Entry</th>
                  <th className={`${th} text-left`}>Details</th>
                  <th className={`${th} text-right`}>Debit</th>
                  <th className={`${th} text-right`}>Credit</th>
                  <th className={`${th} text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50/80">
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(row.date)}</td>
                    <td className={td}>
                      <p className="font-semibold text-slate-800">{row.kind}</p>
                      {row.ref && <p className="font-mono text-[11px] text-slate-400">{row.ref}</p>}
                    </td>
                    <td className={`${td} max-w-[16rem] text-slate-600`} title={row.details}>
                      {row.vehicleNo && <p className="truncate font-mono font-semibold text-slate-800">{row.vehicleNo}</p>}
                      <p className="truncate">{row.details || '—'}</p>
                    </td>
                    <td className={`${td} text-right tabular-nums text-blue-700`}>{row.debit ? formatRupees(row.debit) : ''}</td>
                    <td className={`${td} text-right tabular-nums text-amber-700`}>{row.credit ? formatRupees(row.credit) : ''}</td>
                    <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums ${row.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{balanceText(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 md:hidden">
            {rows.map((row, index) => (
              <div key={index} className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold text-slate-900">{row.kind} <span className="font-normal text-slate-400">· {formatDate(row.date)}</span></span>
                  <span className={`shrink-0 text-[13px] font-bold tabular-nums ${row.debit ? 'text-blue-700' : 'text-amber-700'}`}>{row.debit ? `+${formatRupees(row.debit)}` : `−${formatRupees(row.credit)}`}</span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3 text-[11px] text-slate-500">
                  <span className="min-w-0 truncate">{[row.ref, row.vehicleNo, row.details].filter(Boolean).join(' · ') || '—'}</span>
                  <span className={`shrink-0 font-semibold ${row.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{balanceText(row.balance)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 md:text-xs">Dr: the party owes you. Cr: you owe the party.</p>
    </section>
  );
}

/* ───────────── Trips ───────────── */

function TripReport({ period, onParty }) {
  const { data, loading, error } = useFetch('/reports/trips', periodParams(period), null);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [partySearch, setPartySearch] = useState('');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const { totals } = data;
  const vehicleQuery = vehicleSearch.trim().toLowerCase();
  const partyQuery = partySearch.trim().toLowerCase();
  const byVehicle = data.byVehicle.filter((row) => matches(vehicleQuery, row.vehicleNo));
  const byParty = data.byParty.filter((row) => matches(partyQuery, row.name));
  const hasMaterial = totals.materialSold > 0 || totals.materialCost > 0;
  const maxBilling = Math.max(...byVehicle.map((row) => row.billing), 0);
  const columns = (first) => [
    first,
    { key: 'trips', label: 'Trips', align: 'right', render: (row) => row.trips, total: (t) => t.trips },
    { key: 'billing', label: 'Billing', align: 'right', primary: true, render: (row) => formatRupees(row.billing), total: (t) => formatRupees(t.billing) },
    { key: 'received', label: 'Received', align: 'right', render: (row) => rupees(row.received), total: (t) => rupees(t.received) },
    ...(hasMaterial ? [
      { key: 'matSold', label: 'Material Sold', align: 'right', render: (row) => rupees(row.materialSold), total: (t) => rupees(t.materialSold), phoneHide: true },
      { key: 'matCost', label: 'Material Cost', align: 'right', render: (row) => rupees(row.materialCost), total: (t) => rupees(t.materialCost), phoneHide: true },
    ] : []),
    { key: 'due', label: 'Unpaid', align: 'right', render: (row) => <Due value={row.due} />, total: (t) => <Due value={t.due} /> },
  ];
  return (
    <>
      <ErrorBox message={error} />
      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Route} tone="blue" label="Trips" value={formatNumber(totals.trips, 0)} hint={periodText(period)} />
        <StatCard compact icon={Receipt} tone="indigo" label="Billing" value={formatRupees(totals.billing)} hint="Total billed on trips" />
        <StatCard compact icon={ArrowDownLeft} tone="emerald" label="Received on Trips" value={formatRupees(totals.received)} hint="Paid when the trip was entered" />
        <StatCard compact icon={Scale} tone={totals.due > 0 ? 'rose' : 'slate'} label="Unpaid on Trips" value={formatRupees(totals.due)} hint="Later payments: see Party Ledger" />
      </section>
      {hasMaterial && (
        <section className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <span className="font-semibold">Material we supplied</span>
          <span>Sold <b>{formatRupees(totals.materialSold)}</b></span>
          <span>Bought <b>{formatRupees(totals.materialCost)}</b></span>
          <span className={totals.materialProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{totals.materialProfit >= 0 ? 'Profit' : 'Loss'} <b>{formatRupees(Math.abs(totals.materialProfit))}</b></span>
        </section>
      )}

      <Panel title="Trips by Vehicle" count={byVehicle.length} search={vehicleSearch} onSearch={setVehicleSearch} searchPlaceholder="Search vehicle no." exportName="trips-by-vehicle">
        <ReportTable
          rows={byVehicle}
          rowKey={(row) => row.vehicleId}
          totals={vehicleQuery ? null : totals}
          empty="No trips in this period"
          columns={columns({
            key: 'vehicle',
            label: 'Vehicle',
            main: true,
            render: (row) => (
              <span className="inline-flex flex-col">
                <Link to={`/vehicles/${row.vehicleId}`} className="font-mono font-semibold text-blue-700 hover:underline">{row.vehicleNo}</Link>
                <span className="hidden md:block"><Share value={row.billing} max={maxBilling} /></span>
              </span>
            ),
          })}
        />
      </Panel>

      <Panel title="Trips by Party" count={byParty.length} hint="Tap a party to open its ledger." search={partySearch} onSearch={setPartySearch} searchPlaceholder="Search party" exportName="trips-by-party">
        <ReportTable
          rows={byParty}
          rowKey={(row) => row.partyId}
          totals={partyQuery ? null : totals}
          onRowClick={(row) => onParty(row.partyId)}
          empty="No trips in this period"
          columns={columns({ key: 'party', label: 'Party', main: true, render: (row) => <span className="font-semibold text-slate-800">{row.name}</span> })}
        />
      </Panel>
    </>
  );
}

/* ───────────── Expenses ───────────── */

function ExpenseReport({ period }) {
  const { data, loading, error } = useFetch('/reports/expenses', periodParams(period), null);
  const [typeSearch, setTypeSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const { totals } = data;
  const maxCategory = Math.max(...data.byCategory.map((row) => row.amount), 0);
  const general = data.byVehicle.find((row) => !row.vehicleId);
  // The top expense card is for the whole period, whatever is searched
  const top = data.byCategory[0];
  const typeQuery = typeSearch.trim().toLowerCase();
  const vehicleQuery = vehicleSearch.trim().toLowerCase();
  const byCategory = data.byCategory.filter((row) => matches(typeQuery, row.category));
  const byVehicle = data.byVehicle.filter((row) => matches(vehicleQuery, row.vehicleNo));
  return (
    <>
      <ErrorBox message={error} />
      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-3">
        <StatCard compact icon={Wallet} tone="rose" label="Total Expenses" value={formatRupees(totals.amount)} hint={`${totals.count} entries`} />
        <StatCard compact icon={Fuel} tone="amber" label="Top Expense" value={top ? top.category : '—'} hint={top ? formatRupees(top.amount) : ''} />
        <StatCard compact icon={BookOpen} tone="slate" label="General / Office" value={formatRupees(general?.amount || 0)} hint="No vehicle" />
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="By Expense Type" count={byCategory.length} search={typeSearch} onSearch={setTypeSearch} searchPlaceholder="Search type" exportName="expenses-by-type">
          <ReportTable
            rows={byCategory}
            rowKey={(row) => row.category}
            totals={typeQuery ? null : totals}
            empty="No expenses in this period"
            columns={[
              {
                key: 'category',
                label: 'Type',
                main: true,
                render: (row) => <span className="inline-flex flex-col"><span className="font-semibold text-slate-800">{row.category}</span><span className="hidden md:block"><Share value={row.amount} max={maxCategory} tone="bg-rose-500" /></span></span>,
              },
              { key: 'count', label: 'Entries', align: 'right', render: (row) => row.count, total: (t) => t.count },
              { key: 'amount', label: 'Amount', align: 'right', primary: true, render: (row) => formatRupees(row.amount), total: (t) => formatRupees(t.amount) },
              { key: 'share', label: 'Share', align: 'right', render: (row) => `${totals.amount ? Math.round((row.amount / totals.amount) * 100) : 0}%` },
            ]}
          />
        </Panel>

        <Panel title="By Vehicle" count={byVehicle.length} search={vehicleSearch} onSearch={setVehicleSearch} searchPlaceholder="Search vehicle no." exportName="expenses-by-vehicle">
          <ReportTable
            rows={byVehicle}
            rowKey={(row) => row.vehicleId || 'general'}
            totals={vehicleQuery ? null : totals}
            empty="No expenses in this period"
            columns={[
              {
                key: 'vehicle',
                label: 'Vehicle',
                main: true,
                render: (row) => (row.vehicleId
                  ? <Link to={`/vehicles/${row.vehicleId}`} className="font-mono font-semibold text-blue-700 hover:underline">{row.vehicleNo}</Link>
                  : <span className="text-slate-500">{row.vehicleNo}</span>),
              },
              { key: 'count', label: 'Entries', align: 'right', render: (row) => row.count, total: (t) => t.count },
              { key: 'amount', label: 'Amount', align: 'right', primary: true, render: (row) => formatRupees(row.amount), total: (t) => formatRupees(t.amount) },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

/* ───────────── Tyre Puncture History ───────────── */

function PunctureReport({ period }) {
  // The vehicle filter goes to the server, so the cards, tables and totals are all for that vehicle
  const [vehicleId, setVehicleId] = useState('');
  const { data, loading, error } = useFetch('/reports/punctures', { ...periodParams(period), ...(vehicleId ? { vehicleId } : {}) }, null);
  const { data: vehicleList } = useFetch('/vehicles', {}, []);
  const vehicles = Array.isArray(vehicleList) ? vehicleList : [];
  const chosenNo = vehicles.find((item) => item._id === vehicleId)?.vehicleNo || '';

  const filter = (
    <section className="no-print flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-72">
        <VehicleSelect vehicles={vehicles} value={vehicleId} onChange={setVehicleId} allowEmpty emptyLabel="All Vehicles" includeSold id="puncture-vehicle" />
      </div>
      {vehicleId && <button type="button" className="btn-secondary btn-sm" onClick={() => setVehicleId('')}><X size={14} /> Clear Filter</button>}
      {loading && data && <span className="text-xs text-slate-400">Updating…</span>}
    </section>
  );

  if (loading && !data) return <>{filter}<Loading /></>;
  if (!data) return <>{filter}<ErrorBox message={error} /></>;
  const { totals, byVehicle, entries } = data;
  const maxAmount = Math.max(...byVehicle.map((row) => row.amount), 0);
  const shown = entries;
  const shownTotal = shown.reduce((sum, row) => sum + row.amount, 0);
  const worst = byVehicle[0];

  return (
    <>
      {filter}
      <ErrorBox message={error} />
      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-3">
        <StatCard compact icon={IndianRupee} tone="amber" label="Total Puncture Expense" value={formatRupees(totals.amount)} hint={periodText(period)} />
        <StatCard compact icon={CircleDot} tone="rose" label="Punctures" value={formatNumber(totals.count, 0)} hint={`${totals.onTrips} on trips`} />
        <StatCard compact icon={Truck} tone="slate" label="Most Punctures" value={worst ? worst.vehicleNo : '—'} hint={worst ? `${worst.count} · ${formatRupees(worst.amount)}` : ''} />
      </section>

      <Panel title="Punctures by Vehicle" count={byVehicle.length} hint="Tap a vehicle to see only its punctures below." exportName="punctures-by-vehicle">
        <ReportTable
          rows={byVehicle}
          rowKey={(row) => row.vehicleId || 'none'}
          selected={vehicleId}
          onRowClick={(row) => setVehicleId(row.vehicleId === vehicleId ? '' : row.vehicleId)}
          totals={totals}
          empty="No tyre punctures in this period"
          columns={[
            {
              key: 'vehicle',
              label: 'Vehicle',
              main: true,
              render: (row) => <span className="inline-flex flex-col"><span className="font-mono font-semibold text-slate-800">{row.vehicleNo}</span><span className="hidden md:block"><Share value={row.amount} max={maxAmount} tone="bg-rose-500" /></span></span>,
            },
            { key: 'count', label: 'Punctures', align: 'right', render: (row) => row.count, total: (t) => t.count },
            { key: 'amount', label: 'Expense', align: 'right', primary: true, render: (row) => formatRupees(row.amount), total: (t) => formatRupees(t.amount) },
          ]}
        />
      </Panel>

      <Panel
        title={vehicleId ? `Puncture History · ${chosenNo}` : 'Puncture History'}
        count={shown.length}
        exportName="tyre-puncture-history"
        actions={vehicleId && <button type="button" className="btn-secondary btn-sm no-print" onClick={() => setVehicleId('')}><X size={14} /> All vehicles</button>}
      >
        <ReportTable
          rows={shown}
          rowKey={(row) => row.id}
          totals={{ amount: shownTotal }}
          empty="No tyre punctures in this period"
          columns={[
            {
              key: 'trip',
              label: 'Trip No.',
              main: true,
              render: (row) => (
                <span>
                  {row.trip
                    ? <><span className="font-mono font-semibold text-slate-800">{row.trip.tripNo}</span>{row.trip.route && <span className="ml-2 hidden text-[11px] text-slate-400 md:inline">{row.trip.route}</span>}</>
                    : <span className="text-slate-400">No trip</span>}
                  {/* Phones: the puncture date right beside the trip number (the Puncture Date column is the desktop's) */}
                  <span className="ml-2 font-semibold text-slate-700 md:hidden">· {formatDate(row.date)}</span>
                </span>
              ),
            },
            { key: 'vehicle', label: 'Vehicle No.', render: (row) => <span className="font-mono">{row.vehicleNo}</span> },
            // The date is already on the phone's top line, so it is not repeated in the small line below
            { key: 'date', label: 'Puncture Date', render: (row) => <span className="font-semibold text-slate-800">{formatDate(row.date)}</span>, phoneHide: true },
            { key: 'amount', label: 'Puncture Expense', align: 'right', primary: true, render: (row) => formatRupees(row.amount), total: (t) => formatRupees(t.amount) },
          ]}
        />
      </Panel>
    </>
  );
}

/* ───────────── Vehicles (profit per vehicle, from the profit report) ───────────── */

const OWNERSHIP_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'own', label: 'My vehicles' },
  { key: 'hired', label: 'Hired' },
];

function VehicleReport({ period }) {
  const { data, loading, error } = useFetch('/reports/profit', periodParams(period), null);
  const [search, setSearch] = useState('');
  const [ownership, setOwnership] = useState('all');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const totals = data.totals || {};
  const query = search.trim().toLowerCase();
  const rows = (data.vehicles || [])
    .filter((row) => ownership === 'all' || row.ownership === ownership)
    .filter((row) => !query || String(row.vehicleNo || '').toLowerCase().includes(query) || String(row.ownerName || '').toLowerCase().includes(query));
  const filtered = Boolean(query) || ownership !== 'all';
  const vehicleCosts = toNumber(totals.tripHireCost) + toNumber(totals.materialCost) + toNumber(totals.rentCost) + toNumber(totals.vehicleExpenses);
  const minus = (value) => (value ? `− ${formatRupees(value)}` : '—');

  return (
    <>
      <ErrorBox message={error} />
      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={IndianRupee} tone="emerald" label="Income" value={formatRupees(totals.income)} hint={`Trips ${formatRupees(totals.tripIncome)} · Rent ${formatRupees(totals.rentIncome)}`} />
        <StatCard compact icon={Wallet} tone="rose" label="Vehicle Costs" value={formatRupees(vehicleCosts)} hint="Hire, material, rent and expenses" />
        <StatCard compact icon={Building2} tone="slate" label="General Expenses" value={formatRupees(totals.generalExpenses)} hint="Office and other, no vehicle" />
        <StatCard compact icon={TrendingUp} tone={toNumber(totals.profit) >= 0 ? 'blue' : 'rose'} label="Net Profit" value={formatRupees(totals.profit)} hint="Whole business" />
      </section>

      <Panel
        title="Vehicle-wise Profit"
        count={rows.length}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search vehicle no."
        exportName="vehicle-report"
        actions={<Segmented value={ownership} onChange={setOwnership} options={OWNERSHIP_FILTERS} />}
        hint={filtered ? 'Totals are left out while a search or filter is on.' : 'Net business profit is the vehicles total less general / office expenses.'}
      >
        <ReportTable
          rows={rows}
          rowKey={(row) => row.vehicleId}
          totals={filtered ? null : totals}
          empty="No vehicles"
          columns={[
            {
              key: 'vehicle',
              label: 'Vehicle',
              main: true,
              render: (row) => (
                <span className="inline-flex flex-col">
                  <Link to={`/vehicles/${row.vehicleId}`} className="font-mono font-semibold text-blue-700 hover:underline">{row.vehicleNo}</Link>
                  <span className="text-[11px] text-slate-500">{row.ownership === 'own' ? 'Mine' : `Hired · ${row.ownerName || ''}`}</span>
                </span>
              ),
            },
            { key: 'trips', label: 'Trips', align: 'right', render: (row) => row.trips || '—', total: (t) => t.trips },
            { key: 'tripIncome', label: 'Trip Billing', align: 'right', render: (row) => rupees(row.tripIncome), total: (t) => formatRupees(t.tripIncome) },
            { key: 'rentIncome', label: 'Rent Received', align: 'right', render: (row) => rupees(row.rentIncome), total: (t) => formatRupees(t.rentIncome), phoneHide: true },
            { key: 'tripHireCost', label: 'Trip Hire', align: 'right', render: (row) => minus(row.tripHireCost), total: (t) => formatRupees(t.tripHireCost), phoneHide: true },
            { key: 'materialCost', label: 'Material Cost', align: 'right', render: (row) => minus(row.materialCost), total: (t) => formatRupees(t.materialCost), phoneHide: true },
            { key: 'rentCost', label: 'Rent Paid', align: 'right', render: (row) => minus(row.rentCost), total: (t) => formatRupees(t.rentCost), phoneHide: true },
            { key: 'expenses', label: 'Expenses', align: 'right', render: (row) => minus(row.expenses), total: (t) => formatRupees(t.vehicleExpenses) },
            {
              key: 'profit',
              label: 'Profit',
              align: 'right',
              primary: true,
              render: (row) => <span className={`font-bold ${row.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatRupees(row.profit)}</span>,
              total: (t) => formatRupees(toNumber(t.profit) + toNumber(t.generalExpenses)),
            },
          ]}
        />
      </Panel>
    </>
  );
}

/* ───────────── Payments (received from / paid to parties) ───────────── */

const PAYMENT_TYPES = [
  { key: 'all', label: 'All' },
  { key: 'received', label: 'Received' },
  { key: 'paid', label: 'Paid' },
];
const modeLabel = (mode) => PAYMENT_MODE_OPTIONS.find((option) => option.value === mode)?.label || mode || '—';

function PaymentReport({ period }) {
  // The payments list takes a from–to range, so a month is sent as its first and last day
  const range = period.from ? { from: period.from, to: period.to } : monthBounds(period.month);
  const { data, loading, error } = useFetch('/payments', { from: range.from, to: range.to }, null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [mode, setMode] = useState('');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const all = Array.isArray(data) ? data : [];
  const query = search.trim().toLowerCase();
  const rows = all
    .filter((row) => type === 'all' || row.type === type)
    .filter((row) => !mode || row.mode === mode)
    .filter((row) => !query || [row.partyId?.name, row.reference, row.notes].some((value) => String(value || '').toLowerCase().includes(query)));
  const sumOf = (list, kind) => list.filter((row) => row.type === kind).reduce((sum, row) => sum + toNumber(row.amount), 0);
  const received = sumOf(rows, 'received');
  const paid = sumOf(rows, 'paid');

  return (
    <>
      <ErrorBox message={error} />
      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-3">
        <StatCard compact icon={ArrowDownLeft} tone="emerald" label="Received" value={formatRupees(received)} hint={`${rows.filter((row) => row.type === 'received').length} payments`} />
        <StatCard compact icon={ArrowUpRight} tone="rose" label="Paid" value={formatRupees(paid)} hint={`${rows.filter((row) => row.type === 'paid').length} payments`} />
        <StatCard compact icon={Scale} tone="blue" label="Net" value={formatRupees(received - paid)} hint="Received minus paid" />
      </section>

      <Panel
        title="Payments"
        count={rows.length}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search party, reference"
        exportName="payment-report"
        actions={(
          <>
            <Segmented value={type} onChange={setType} options={PAYMENT_TYPES} />
            <select className="input h-9 min-h-0 w-auto py-0 text-xs md:text-sm" value={mode} onChange={(event) => setMode(event.target.value)} aria-label="Payment mode">
              <option value="">All modes</option>
              {PAYMENT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </>
        )}
      >
        <ReportTable
          rows={rows}
          rowKey={(row) => row._id}
          totals={{ received, paid }}
          empty="No payments in this period"
          columns={[
            { key: 'date', label: 'Date', main: true, render: (row) => <span className="font-semibold text-slate-800">{formatDate(row.date)}</span> },
            {
              key: 'party',
              label: 'Party',
              render: (row) => (row.partyId?._id
                ? <Link to={`/parties/${row.partyId._id}`} className="font-semibold text-blue-700 hover:underline">{row.partyId.name}</Link>
                : '—'),
            },
            { key: 'mode', label: 'Mode', render: (row) => modeLabel(row.mode) },
            { key: 'reference', label: 'Reference', render: (row) => row.reference || '—', phoneHide: true },
            { key: 'received', label: 'Received', align: 'right', render: (row) => (row.type === 'received' ? <span className="font-semibold text-emerald-700">{formatRupees(row.amount)}</span> : '—'), total: (t) => formatRupees(t.received) },
            { key: 'paid', label: 'Paid', align: 'right', render: (row) => (row.type === 'paid' ? <span className="font-semibold text-rose-700">{formatRupees(row.amount)}</span> : '—'), total: (t) => formatRupees(t.paid) },
            {
              key: 'amount',
              label: 'Amount',
              align: 'right',
              primary: true,
              phoneOnly: true,
              render: (row) => <span className={row.type === 'received' ? 'text-emerald-700' : 'text-rose-700'}>{row.type === 'received' ? '+' : '−'} {formatRupees(row.amount)}</span>,
              total: (t) => formatRupees(t.received - t.paid),
            },
          ]}
        />
      </Panel>
    </>
  );
}

/* ───────────── Monthly Hire (rent on monthly contracts) ───────────── */

const DIRECTIONS = [
  { key: 'all', label: 'All' },
  { key: 'give_out', label: 'Given out' },
  { key: 'hire_in', label: 'Hired in' },
];
const STATUS_TEXT = { running: 'Running', upcoming: 'Upcoming', ended: 'Ended' };

function MonthlyHireReport({ period }) {
  // Rent is worked out per month, so this report goes by month
  const month = period.month || currentMonthInput();
  const { data, loading, error } = useFetch('/contracts', { month }, null);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('all');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  // Contracts with rent in this month
  const inMonth = (Array.isArray(data) ? data : []).filter((row) => toNumber(row.monthAmount) > 0);
  const query = search.trim().toLowerCase();
  const rows = inMonth
    .filter((row) => direction === 'all' || row.direction === direction)
    .filter((row) => !query || [row.vehicleId?.vehicleNo, row.partyId?.name, row.contractNo].some((value) => String(value || '').toLowerCase().includes(query)));
  const sumOf = (list, kind) => list.filter((row) => row.direction === kind).reduce((sum, row) => sum + toNumber(row.monthAmount), 0);
  const toReceive = sumOf(rows, 'give_out');
  const toPay = sumOf(rows, 'hire_in');

  return (
    <>
      <ErrorBox message={error} />
      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-3">
        <StatCard compact icon={ArrowDownLeft} tone="emerald" label="Rent to Receive" value={formatRupees(toReceive)} hint="Vehicles given out" />
        <StatCard compact icon={ArrowUpRight} tone="rose" label="Rent to Pay" value={formatRupees(toPay)} hint="Vehicles hired in" />
        <StatCard compact icon={Scale} tone="blue" label="Net Rent" value={formatRupees(toReceive - toPay)} hint={formatMonth(month)} />
      </section>

      <Panel
        title="Monthly Hire Contracts"
        count={rows.length}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search vehicle, party"
        exportName="monthly-hire-report"
        actions={<Segmented value={direction} onChange={setDirection} options={DIRECTIONS} />}
        hint="Rent for each contract in this month, counted for the days it ran."
      >
        <ReportTable
          rows={rows}
          rowKey={(row) => row._id}
          totals={{ toReceive, toPay }}
          empty="No monthly hire in this month"
          columns={[
            {
              key: 'vehicle',
              label: 'Vehicle',
              main: true,
              render: (row) => (row.vehicleId?._id
                ? <Link to={`/vehicles/${row.vehicleId._id}`} className="font-mono font-semibold text-blue-700 hover:underline">{row.vehicleId.vehicleNo}</Link>
                : '—'),
            },
            { key: 'contract', label: 'Contract', render: (row) => <span className="font-mono">{row.contractNo}</span>, phoneHide: true },
            { key: 'party', label: 'Party', render: (row) => row.partyId?.name || '—' },
            { key: 'direction', label: 'Type', render: (row) => (row.direction === 'give_out' ? 'Given out' : 'Hired in') },
            { key: 'period', label: 'Period', render: (row) => `${formatDate(row.startDate)} – ${row.endDate ? formatDate(row.endDate) : 'ongoing'}`, phoneHide: true },
            { key: 'status', label: 'Status', render: (row) => STATUS_TEXT[row.status] || row.status, phoneHide: true },
            { key: 'rate', label: 'Monthly Rate', align: 'right', render: (row) => formatRupees(row.monthlyRate), phoneHide: true },
            { key: 'receive', label: 'To Receive', align: 'right', render: (row) => (row.direction === 'give_out' ? <span className="font-semibold text-emerald-700">{formatRupees(row.monthAmount)}</span> : '—'), total: (t) => formatRupees(t.toReceive) },
            { key: 'pay', label: 'To Pay', align: 'right', render: (row) => (row.direction === 'hire_in' ? <span className="font-semibold text-rose-700">{formatRupees(row.monthAmount)}</span> : '—'), total: (t) => formatRupees(t.toPay) },
            {
              key: 'amount',
              label: 'Rent',
              align: 'right',
              primary: true,
              phoneOnly: true,
              render: (row) => <span className={row.direction === 'give_out' ? 'text-emerald-700' : 'text-rose-700'}>{row.direction === 'give_out' ? '+' : '−'} {formatRupees(row.monthAmount)}</span>,
              total: (t) => formatRupees(t.toReceive - t.toPay),
            },
          ]}
        />
      </Panel>
    </>
  );
}

/* ───────────── Reports dashboard and report pages ───────────── */

const CARD_TONES = {
  amber: { card: 'from-amber-50 to-orange-50 border-amber-200 hover:border-amber-300', icon: 'bg-amber-500' },
  indigo: { card: 'from-indigo-50 to-violet-50 border-indigo-200 hover:border-indigo-300', icon: 'bg-indigo-600' },
  rose: { card: 'from-rose-50 to-pink-50 border-rose-200 hover:border-rose-300', icon: 'bg-rose-600' },
  blue: { card: 'from-blue-50 to-sky-50 border-blue-200 hover:border-blue-300', icon: 'bg-blue-600' },
  teal: { card: 'from-teal-50 to-cyan-50 border-teal-200 hover:border-teal-300', icon: 'bg-teal-600' },
  slate: { card: 'from-slate-50 to-gray-50 border-slate-200 hover:border-slate-300', icon: 'bg-slate-600' },
  emerald: { card: 'from-emerald-50 to-teal-50 border-emerald-200 hover:border-emerald-300', icon: 'bg-emerald-600' },
};

/**
 * Every report: its page at /reports/<slug>, its card on the Reports dashboard.
 * period: 'range' (month or from–to), 'month' (month only) or null (no period).
 */
const REPORTS = [
  { slug: 'diesel', title: 'Diesel Report', description: 'Diesel issued to each vehicle, by petrol pump, and every fill.', icon: Fuel, tone: 'amber', period: 'range', Report: DieselReport },
  { slug: 'parties-ledger', title: 'Parties Ledger', description: 'What each party owes you, what you owe them, and their full ledger.', icon: BookOpen, tone: 'indigo', period: null, Report: PartyLedgerReport },
  { slug: 'tyre-puncture', title: 'Tyre Puncture History', description: 'Every puncture with its trip, vehicle, date and cost.', icon: CircleDot, tone: 'rose', period: 'range', Report: PunctureReport },
  { slug: 'trips', title: 'Trip Report', description: 'Trips, billing, received and unpaid by vehicle and by party.', icon: Route, tone: 'blue', period: 'range', Report: TripReport },
  { slug: 'vehicles', title: 'Vehicle Report', description: 'Income, costs and profit of each vehicle.', icon: Truck, tone: 'teal', period: 'range', Report: VehicleReport },
  { slug: 'expenses', title: 'Expense Report', description: 'Expenses by type and by vehicle, with each one’s share.', icon: Wallet, tone: 'slate', period: 'range', Report: ExpenseReport },
  { slug: 'payments', title: 'Payment Report', description: 'Money received from and paid to parties, by mode.', icon: HandCoins, tone: 'emerald', period: 'range', Report: PaymentReport },
  { slug: 'monthly-hire', title: 'Monthly Hire Report', description: 'Rent to receive and to pay on monthly hire contracts.', icon: CalendarClock, tone: 'indigo', period: 'month', Report: MonthlyHireReport },
];

// Links from before the report pages (/business-reports?tab=…) open the matching page
const OLD_TABS = { diesel: 'diesel', ledger: 'parties-ledger', punctures: 'tyre-puncture', trips: 'trips', expenses: 'expenses' };

/** Reports dashboard: one card per report; each opens its own page. */
export default function BusinessReports() {
  const [params] = useSearchParams();
  const oldTab = OLD_TABS[params.get('tab')];
  if (oldTab) {
    const party = params.get('party');
    return <Navigate to={`/reports/${oldTab}${oldTab === 'parties-ledger' && party ? `?party=${party}` : ''}`} replace />;
  }

  return (
    <Page>
      <PageHeader title="Reports" subtitle="Pick a report to open it" />
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {REPORTS.map(({ slug, title, description, icon: Icon, tone }) => {
          const t = CARD_TONES[tone] || CARD_TONES.blue;
          return (
            <Link
              key={slug}
              to={`/reports/${slug}`}
              className={`group flex items-start gap-3 rounded-2xl border-2 bg-gradient-to-br p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 md:p-5 ${t.card}`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${t.icon}`}>
                <Icon size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-slate-900 md:text-base">{title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-600 md:text-[13px]">{description}</span>
              </span>
              <ChevronRight size={18} className="mt-0.5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
            </Link>
          );
        })}
      </section>
    </Page>
  );
}

/** One report on its own page: title, back to the dashboard, its period and the report. */
export function ReportPage() {
  const { report } = useParams();
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState({ month: currentMonthInput() });
  const config = REPORTS.find((item) => item.slug === report);
  if (!config) return <Navigate to="/business-reports" replace />;

  const { Report } = config;
  const partyId = params.get('party') || '';
  // In the ledger, picking a party keeps it in the address (?party=), so a refresh reopens it
  const openParty = (id) => setParams(id ? { party: id } : {}, { replace: true });
  const subtitle = config.period === 'range' ? periodText(period) : config.period === 'month' ? formatMonth(period.month || currentMonthInput()) : config.description;

  return (
    <Page>
      <div className="no-print">
        <Link to="/business-reports" className="btn-secondary btn-sm"><ArrowLeft size={15} /> Back to Reports</Link>
      </div>
      <PageHeader title={config.title} subtitle={subtitle}>
        {config.period === 'range' && <PeriodPicker value={period} onChange={setPeriod} />}
        {config.period === 'month' && <MonthFilter value={period.month || currentMonthInput()} onChange={(month) => setPeriod({ month })} />}
        <button type="button" className="btn-secondary no-print" onClick={() => window.print()}><Printer size={16} /> Print</button>
      </PageHeader>
      <ReportBody key={config.slug} Report={Report} period={period} partyId={partyId} onParty={openParty} slug={config.slug} />
    </Page>
  );
}

// The report itself; a party tapped outside the ledger opens the Parties Ledger page on that party
function ReportBody({ Report, period, partyId, onParty, slug }) {
  const go = useNavigate();
  const openParty = slug === 'parties-ledger' ? onParty : (id) => go(`/reports/parties-ledger?party=${id}`);
  return <div className="space-y-3.5 md:space-y-4"><Report period={period} partyId={partyId} onParty={openParty} /></div>;
}
