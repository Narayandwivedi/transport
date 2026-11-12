import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDownLeft, ArrowUpRight, BookOpen, CalendarRange, ExternalLink, Fuel, Gauge, IndianRupee, Printer, Receipt,
  Route, Scale, Wallet, X,
} from 'lucide-react';
import useFetch from '../utils/useFetch';
import { currentMonthInput, formatDate, formatMonth, formatNumber, formatRupees, monthBounds, todayInput } from '../utils/format';
import { getPartyTypeLabel } from '../utils/constants';
import StatCard from '../components/StatCard';
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
 * columns: [{ key, label, render(row), total?, align?, main?, primary?, phoneHide? }]
 */
function ReportTable({ columns, rows, totals, rowKey, onRowClick, selected, empty }) {
  if (!rows.length) return <EmptyState title={empty || 'Nothing in this period'} />;
  const mainCol = columns.find((col) => col.main) || columns[0];
  const primaryCol = columns.find((col) => col.primary);
  const others = columns.filter((col) => col !== mainCol && col !== primaryCol && !col.phoneHide);
  const th = 'px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 first:pl-4 last:pr-4';
  const td = 'px-3 py-2.5 first:pl-4 last:pr-4';
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>{columns.map((col) => <th key={col.key} className={`${th} ${col.align === 'right' ? 'text-right' : 'text-left'}`}>{col.label}</th>)}</tr>
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
                  {columns.map((col) => <td key={col.key} className={`${td} ${col.align === 'right' ? 'text-right tabular-nums' : ''} whitespace-nowrap`}>{col.render(row)}</td>)}
                </tr>
              );
            })}
          </tbody>
          {totals && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
              <tr>{columns.map((col, index) => <td key={col.key} className={`${td} ${col.align === 'right' ? 'text-right tabular-nums' : ''} whitespace-nowrap`}>{index === 0 ? 'Total' : col.total ? col.total(totals) : ''}</td>)}</tr>
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

const Panel = ({ title, count, hint, children, actions }) => (
  <section className="panel">
    <PanelHeader title={title} count={count}>{actions}</PanelHeader>
    {children}
    {hint && <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 md:text-xs">{hint}</p>}
  </section>
);

/* ───────────── Diesel ───────────── */

function DieselReport({ period }) {
  const { data, loading, error } = useFetch('/reports/diesel', periodParams(period), null);
  const [vehicleId, setVehicleId] = useState('');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const { totals, byVehicle, byPump, entries } = data;
  const maxLitres = Math.max(...byVehicle.map((row) => row.litres), 0);
  const chosen = byVehicle.find((row) => row.vehicleId === vehicleId);
  const shown = vehicleId ? entries.filter((row) => row.vehicleId === vehicleId) : entries;

  return (
    <>
      <ErrorBox message={error} />
      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Fuel} tone="amber" label="Diesel Issued" value={litres(totals.litres)} hint={`${totals.fills} fills`} />
        <StatCard compact icon={IndianRupee} tone="rose" label="Diesel Cost" value={formatRupees(totals.amount)} hint={`Paid ${formatRupees(totals.paid)}`} />
        <StatCard compact icon={Gauge} tone="blue" label="Average Rate" value={totals.avgRate ? `${formatRupees(totals.avgRate)}/ltr` : '—'} hint="Cost ÷ litres" />
        <StatCard compact icon={Scale} tone={totals.due > 0 ? 'rose' : 'slate'} label="Due to Pumps" value={formatRupees(totals.due)} hint="Not paid at the pump" />
      </section>

      <Panel title="Diesel Issued to Each Vehicle" count={byVehicle.length} hint="Tap a vehicle to see its diesel entries below.">
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

      <Panel title="Diesel by Petrol Pump" count={byPump.length}>
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
        title={chosen ? `Diesel Entries · ${chosen.vehicleNo}` : 'All Diesel Entries'}
        count={shown.length}
        actions={chosen && <button type="button" className="btn-secondary btn-sm no-print" onClick={() => setVehicleId('')}><X size={14} /> All vehicles</button>}
      >
        <ReportTable
          rows={shown}
          rowKey={(row) => row.id}
          columns={[
            { key: 'date', label: 'Date', main: true, render: (row) => <span><span className="font-semibold text-slate-800">{formatDate(row.date)}</span><span className="ml-2 font-mono text-[11px] text-slate-400">{row.entryNo}</span></span> },
            { key: 'vehicle', label: 'Vehicle', render: (row) => <span className="font-mono">{row.vehicleNo}</span> },
            { key: 'pump', label: 'Pump', render: (row) => row.pump || '—' },
            { key: 'trip', label: 'Trip', render: (row) => row.tripNo || '—', phoneHide: true },
            { key: 'litres', label: 'Litres', align: 'right', render: (row) => litres(row.litres) },
            { key: 'rate', label: 'Rate', align: 'right', render: (row) => formatRupees(row.rate) },
            { key: 'amount', label: 'Amount', align: 'right', primary: true, render: (row) => formatRupees(row.amount) },
            { key: 'due', label: 'Due', align: 'right', render: (row) => <Due value={Math.max(0, row.amount - row.paid)} /> },
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
    <section className="panel min-w-0">
      <div className="panel-header flex flex-wrap items-start justify-between gap-2 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-slate-900 md:text-base">{party.name}</h2>
          <p className="text-[11px] text-slate-500 md:text-xs">{getPartyTypeLabel(party.type)}{party.mobile ? ` · ${party.mobile}` : ''}</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-1.5">
          <input type="date" className="input h-8 min-h-0 w-auto py-0 text-xs" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
          <input type="date" className="input h-8 min-h-0 w-auto py-0 text-xs" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} aria-label="To" />
          {(from || to) && <button type="button" className="icon-btn" onClick={() => { setFrom(''); setTo(''); }} title="All dates" aria-label="All dates"><X size={15} /></button>}
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
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const { totals, byVehicle, byParty } = data;
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

      <Panel title="Trips by Vehicle" count={byVehicle.length}>
        <ReportTable
          rows={byVehicle}
          rowKey={(row) => row.vehicleId}
          totals={totals}
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

      <Panel title="Trips by Party" count={byParty.length} hint="Tap a party to open its ledger.">
        <ReportTable
          rows={byParty}
          rowKey={(row) => row.partyId}
          totals={totals}
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
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const { totals, byCategory, byVehicle } = data;
  const maxCategory = Math.max(...byCategory.map((row) => row.amount), 0);
  const general = byVehicle.find((row) => !row.vehicleId);
  return (
    <>
      <ErrorBox message={error} />
      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-3">
        <StatCard compact icon={Wallet} tone="rose" label="Total Expenses" value={formatRupees(totals.amount)} hint={`${totals.count} entries`} />
        <StatCard compact icon={Fuel} tone="amber" label="Top Expense" value={byCategory[0] ? byCategory[0].category : '—'} hint={byCategory[0] ? formatRupees(byCategory[0].amount) : ''} />
        <StatCard compact icon={BookOpen} tone="slate" label="General / Office" value={formatRupees(general?.amount || 0)} hint="No vehicle" />
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="By Expense Type" count={byCategory.length}>
          <ReportTable
            rows={byCategory}
            rowKey={(row) => row.category}
            totals={totals}
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

        <Panel title="By Vehicle" count={byVehicle.length}>
          <ReportTable
            rows={byVehicle}
            rowKey={(row) => row.vehicleId || 'general'}
            totals={totals}
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

/* ───────────── page ───────────── */

const TABS = [
  { key: 'diesel', label: 'Diesel', icon: Fuel },
  { key: 'ledger', label: 'Party Ledger', shortLabel: 'Ledger', icon: BookOpen },
  { key: 'trips', label: 'Trips', icon: Route },
  { key: 'expenses', label: 'Expenses', icon: Wallet },
];

/** Reports: diesel issued to each vehicle, party ledgers, trips and expenses for a period. */
export default function BusinessReports() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((item) => item.key === params.get('tab')) ? params.get('tab') : 'diesel';
  const partyId = params.get('party') || '';
  const [period, setPeriod] = useState({ month: currentMonthInput() });

  const go = (next) => setParams(Object.fromEntries(Object.entries(next).filter(([, value]) => value)), { replace: true });
  const openParty = (id) => go({ tab: 'ledger', party: id });

  return (
    <Page>
      <PageHeader title="Reports" subtitle={tab === 'ledger' ? 'What each party owes you, and what you owe them' : `Business reports · ${periodText(period)}`}>
        {tab !== 'ledger' && <PeriodPicker value={period} onChange={setPeriod} />}
        <button type="button" className="btn-secondary no-print" onClick={() => window.print()}><Printer size={16} /> Print</button>
      </PageHeader>
      <Segmented value={tab} onChange={(key) => go({ tab: key, party: key === 'ledger' ? partyId : '' })} options={TABS} className="no-print" />

      {tab === 'diesel' && <DieselReport period={period} />}
      {tab === 'ledger' && <PartyLedgerReport partyId={partyId} onParty={openParty} />}
      {tab === 'trips' && <TripReport period={period} onParty={openParty} />}
      {tab === 'expenses' && <ExpenseReport period={period} />}
    </Page>
  );
}
