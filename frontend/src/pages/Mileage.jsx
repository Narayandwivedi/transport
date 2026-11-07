import { Fragment, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Droplet, Fuel, Gauge, Route } from 'lucide-react';
import useFetch from '../utils/useFetch';
import useMasters from '../utils/useMasters';
import { formatDate, formatNumber, formatRupees } from '../utils/format';
import StatCard from '../components/StatCard';
import { VehicleSelect } from '../components/Pickers';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, TD, TH } from '../components/ui';

const PERIODS = [
  { value: 3, label: '3 Months' },
  { value: 6, label: '6 Months' },
  { value: 12, label: '12 Months' },
  { value: 0, label: 'All Time' },
];

// Where a meter reading was noted
const SOURCE_LABELS = { meter: 'Meter reading', diesel: 'Diesel fill', stock: 'Stock issue', trip: 'Trip' };

// "4.25 km/l", or "5.1 ltr/hr" on an hour meter
const mileageText = (value, unit) => (value === null || value === undefined ? '—' : `${formatNumber(value, 2)} ${unit === 'hrs' ? 'ltr/hr' : 'km/l'}`);
const meterText = (value, unit) => `${formatNumber(value, unit === 'hrs' ? 1 : 0)} ${unit}`;

const STATE_BADGES = {
  ok: { label: 'OK', className: 'badge-green' },
  low: { label: 'Low', className: 'badge-red' },
  no_data: { label: 'Not enough data', className: 'badge-gray' },
};

/**
 * Long-term mileage of each vehicle: km run on the meter ÷ diesel put in (pump fills and stock issues).
 * Worked out on the server over the chosen period; a row opens to show the readings and diesel behind it.
 */
export default function Mileage() {
  const [months, setMonths] = useState(3);
  const [vehicleId, setVehicleId] = useState('');
  const [open, setOpen] = useState('');
  const { vehicles } = useMasters();
  const { data, loading, error, reload } = useFetch('/reports/mileage', { months, vehicleId }, null);

  const rows = data?.vehicles || [];
  const fleet = data?.fleet;
  const margin = Math.round((data?.lowMargin ?? 0.1) * 100);
  const periodText = months ? `Last ${months} months` : 'All time';

  return (
    <Page>
      <PageHeader title="Mileage" subtitle="How much each vehicle runs per litre of diesel, from its meter readings and the diesel it got" />
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Gauge} tone="indigo" label="Fleet Average" value={mileageText(fleet?.mileage, 'km')} hint={`${periodText} · km meters`} />
        <StatCard compact icon={Route} tone="blue" label="Km Run" value={`${formatNumber(fleet?.km || 0, 0)} km`} hint="Between first and last reading" />
        <StatCard compact icon={Droplet} tone="amber" label="Diesel Used" value={`${formatNumber(fleet?.litres || 0, 0)} ltr`} hint={fleet?.amount ? formatRupees(fleet.amount) : 'Pump fills + stock issues'} />
        <StatCard compact icon={AlertTriangle} tone={fleet?.lowCount ? 'rose' : 'slate'} label="Low Mileage" value={fleet?.lowCount || 0} hint={`More than ${margin}% below expected`} />
      </section>

      <section className="panel">
        <PanelHeader title="Vehicles" count={rows.length} onRefresh={reload} loading={loading}>
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMonths(option.value)}
                aria-pressed={months === option.value}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${months === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="w-48"><VehicleSelect vehicles={vehicles} value={vehicleId} onChange={setVehicleId} allowEmpty emptyLabel="All vehicles" includeSold /></div>
        </PanelHeader>

        {loading && !data ? <Loading /> : rows.length === 0 ? (
          <EmptyState title="No vehicles" hint="Add a vehicle to see its mileage." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Vehicle</th>
                  <th className={TH}>Meter (first → last)</th>
                  <th className={TH}>Run</th>
                  <th className={TH}>Diesel</th>
                  <th className={TH}>Mileage</th>
                  <th className={TH}>Expected</th>
                  <th className={TH}>Diesel Cost</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const key = String(row.vehicleId);
                  const isOpen = open === key;
                  const badge = STATE_BADGES[row.state];
                  const canOpen = Boolean(row.low);
                  return (
                    <Fragment key={key}>
                      <tr className={`tbl-row ${canOpen ? 'cursor-pointer' : ''} ${row.state === 'low' ? 'bg-rose-50/50' : ''}`} onClick={() => canOpen && setOpen(isOpen ? '' : key)}>
                        <td className={`${TD} whitespace-nowrap`}>
                          <span className="flex items-center gap-1.5">
                            {canOpen ? (isOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />) : <span className="w-3.5" />}
                            <span className="font-mono font-semibold">{row.vehicleNo}</span>
                          </span>
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>
                          {row.low ? (
                            <>
                              <p>{meterText(row.low.value, row.unit)} → {meterText(row.high.value, row.unit)}</p>
                              <p className="text-[11px] text-slate-500">{formatDate(row.low.date)} → {formatDate(row.high.date)}</p>
                            </>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className={`${TD} whitespace-nowrap font-semibold`}>{row.km > 0 ? meterText(row.km, row.unit) : '—'}</td>
                        <td className={`${TD} whitespace-nowrap`}>
                          {row.litres > 0 ? `${formatNumber(row.litres, 2)} ltr` : '—'}
                          {row.totalLitres > row.litres && <p className="text-[11px] text-slate-500">{formatNumber(row.totalLitres - row.litres, 2)} ltr not used yet</p>}
                        </td>
                        <td className={`${TD} whitespace-nowrap text-base font-bold ${row.state === 'low' ? 'text-rose-700' : 'text-primary-700'}`}>{mileageText(row.mileage, row.unit)}</td>
                        <td className={`${TD} whitespace-nowrap`}>
                          {row.expected ? mileageText(row.expected, row.unit) : <span className="text-xs text-slate-400">Not set</span>}
                          {row.vsExpected !== null && row.vsExpected !== undefined && row.mileage !== null && (
                            <p className={`text-[11px] ${row.state === 'low' ? 'text-rose-600' : 'text-slate-500'}`}>
                              {row.vsExpected > 0 ? '+' : ''}{Math.round(row.vsExpected * 100)}%
                            </p>
                          )}
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>{row.costPerUnit ? `${formatRupees(row.costPerUnit)}/${row.unit === 'hrs' ? 'hr' : 'km'}` : '—'}</td>
                        <td className={TD}>
                          <span className={badge.className}>{badge.label}</span>
                          {row.reason && <p className="mt-0.5 text-[11px] text-slate-500">{row.reason}</p>}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50 px-5 py-3">
                            <Breakdown row={row} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card space-y-1.5 text-xs text-slate-600">
        <p className="font-semibold text-slate-800">How mileage is worked out</p>
        <p>
          <b>Run</b> = the highest meter reading in the period − the lowest. Readings are taken from Meter Reading entries,
          the meter noted at a diesel fill or stock issue, and trips&apos; start / end km.
        </p>
        <p>
          <b>Diesel</b> = all diesel the vehicle got (pump fills and diesel issued from stock) from the day of the lowest
          reading up to the day of the highest. Diesel filled on the last day is left out, as it is not used yet.
        </p>
        <p>
          <b>Mileage</b> = run ÷ diesel (km/l). Hour-meter vehicles show litres per hour, where lower is better.
          A longer period gives a steadier figure. Set <b>Expected Mileage</b> on a vehicle to flag it when it falls more than {margin}% short.
        </p>
      </section>
    </Page>
  );
}

// The two readings and the diesel entries behind one vehicle's figure
function Breakdown({ row }) {
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-700">Meter</p>
        {[['From', row.low], ['To', row.high]].map(([label, point]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-slate-200">
            <span className="text-slate-500">{label} · {formatDate(point.date)}</span>
            <span className="text-right">
              <b className="text-slate-900">{meterText(point.value, row.unit)}</b>
              <span className="ml-1.5 text-slate-500">{SOURCE_LABELS[point.source] || point.source}{point.ref ? ` ${point.ref}` : ''}</span>
            </span>
          </div>
        ))}
        <p className="text-xs text-slate-500">{row.readings} readings in the period</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-700">Diesel counted ({row.entries.length})</p>
        {row.entries.length === 0 ? (
          <p className="text-xs text-slate-500">No diesel between the two readings.</p>
        ) : (
          <div className="max-h-56 overflow-y-auto rounded-lg bg-white ring-1 ring-slate-200">
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-slate-100">
                {row.entries.map((entry, index) => (
                  <tr key={`${entry.ref}-${index}`}>
                    <td className="whitespace-nowrap px-3 py-1.5">{formatDate(entry.date)}</td>
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Fuel size={12} /> {entry.source === 'stock' ? 'From stock' : 'Pump fill'}{entry.ref ? ` · ${entry.ref}` : ''}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-semibold">{formatNumber(entry.litres, 2)} ltr</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{entry.meter ? meterText(entry.meter, row.unit) : ''}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right">{entry.amount ? formatRupees(entry.amount) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
