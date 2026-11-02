import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fuel, IndianRupee, RotateCcw, Route, Scale, TrendingUp } from 'lucide-react';
import useMasters from '../utils/useMasters';
import { formatNumber, formatRupees, round2, toNumber } from '../utils/format';
import StatCard from '../components/StatCard';
import FormSection from '../components/FormSection';
import { Field, MoneyInput, Page, PageHeader } from '../components/ui';

const STORE_KEY = 'transport-calculator';

const DEFAULTS = {
  from: '', to: '', distance: '', roundTrip: true, tons: '', mileage: '4', dieselPrice: '92',
  toll: '', driverPerDay: '800', days: '1', loading: '', otherCost: '', perKmUpkeep: '3', fixedPerDay: '',
  marginPercent: '15',
};

const readStored = () => {
  try {
    return { ...DEFAULTS, ...JSON.parse(window.localStorage.getItem(STORE_KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
};

/**
 * What a trip costs to run and what to charge for it.
 * Diesel = km ÷ mileage × price. Upkeep (tyres, service) per km. Driver and fixed costs (EMI, insurance) per day.
 */
export default function Calculator() {
  const navigate = useNavigate();
  const { vehicles } = useMasters();
  const [form, setForm] = useState(readStored);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(form));
    } catch {
      // Storage can be blocked; the calculator still works
    }
  }, [form]);

  const result = useMemo(() => {
    const oneWay = toNumber(form.distance);
    const km = form.roundTrip ? oneWay * 2 : oneWay;
    const litres = toNumber(form.mileage) > 0 ? km / toNumber(form.mileage) : 0;
    const diesel = litres * toNumber(form.dieselPrice);
    const days = Math.max(1, toNumber(form.days));
    const driver = toNumber(form.driverPerDay) * days;
    const upkeep = km * toNumber(form.perKmUpkeep);
    const fixed = toNumber(form.fixedPerDay) * days;
    const lines = [
      { label: `Diesel (${formatNumber(litres, 1)} L)`, value: diesel },
      { label: 'Toll / Tax', value: toNumber(form.toll) },
      { label: `Driver (${days} day${days === 1 ? '' : 's'})`, value: driver },
      { label: 'Tyre & service wear', value: upkeep },
      { label: 'EMI / insurance / fixed', value: fixed },
      { label: 'Loading / unloading', value: toNumber(form.loading) },
      { label: 'Other', value: toNumber(form.otherCost) },
    ];
    const cost = lines.reduce((total, line) => total + line.value, 0);
    const price = cost * (1 + toNumber(form.marginPercent) / 100);
    const tons = toNumber(form.tons);
    return {
      km,
      litres,
      lines,
      cost: round2(cost),
      price: round2(price),
      profit: round2(price - cost),
      costPerKm: km ? cost / km : 0,
      pricePerKm: oneWay ? price / oneWay : 0,
      pricePerTon: tons ? price / tons : 0,
      costPerTon: tons ? cost / tons : 0,
    };
  }, [form]);

  // Carry the worked-out price to a new quotation
  const makeQuotation = (basis) => {
    const quantity = basis === 'per_ton' ? toNumber(form.tons) : basis === 'per_km' ? toNumber(form.distance) : 1;
    const rate = basis === 'per_ton' ? result.pricePerTon : basis === 'per_km' ? result.pricePerKm : result.price;
    navigate('/quotations/new', {
      state: {
        item: { description: 'Transportation charges', from: form.from, to: form.to, basis, quantity, rate: Math.ceil(rate) },
      },
    });
  };

  const pickVehicleLoad = (vehicleId) => {
    const vehicle = vehicles.find((item) => item._id === vehicleId);
    if (vehicle?.capacityTons && !form.tons) set('tons', String(vehicle.capacityTons));
  };

  return (
    <Page>
      <PageHeader title="Transport Cost Calculator" subtitle="Work out what a trip costs and what to quote">
        <button type="button" className="btn-secondary" onClick={() => setForm(DEFAULTS)}><RotateCcw size={16} /> Reset</button>
      </PageHeader>

      <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          <FormSection number={1} title="Route & Load" tone="blue">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="From" htmlFor="calc-from"><input id="calc-from" className="input" value={form.from} onChange={(event) => set('from', event.target.value)} placeholder="Raipur" /></Field>
              <Field label="To" htmlFor="calc-to"><input id="calc-to" className="input" value={form.to} onChange={(event) => set('to', event.target.value)} placeholder="Nagpur" /></Field>
              <Field label="Distance (one way)"><MoneyInput prefix="" suffix="km" value={form.distance} onChange={(value) => set('distance', value)} /></Field>
              <Field label="Load"><MoneyInput prefix="" suffix="ton" value={form.tons} onChange={(value) => set('tons', value)} /></Field>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-primary-600" checked={form.roundTrip} onChange={(event) => set('roundTrip', event.target.checked)} />
                Count the empty return (round trip)
              </label>
              {vehicles.length > 0 && (
                <select className="input w-auto" defaultValue="" onChange={(event) => pickVehicleLoad(event.target.value)}>
                  <option value="" disabled>Fill load from vehicle…</option>
                  {vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.vehicleNo}{vehicle.capacityTons ? ` · ${vehicle.capacityTons} t` : ''}</option>)}
                </select>
              )}
            </div>
          </FormSection>

          <FormSection number={2} title="Running Costs" tone="amber">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="Mileage"><MoneyInput prefix="" suffix="km/L" value={form.mileage} onChange={(value) => set('mileage', value)} /></Field>
              <Field label="Diesel Price"><MoneyInput value={form.dieselPrice} onChange={(value) => set('dieselPrice', value)} suffix="/L" /></Field>
              <Field label="Toll / Tax"><MoneyInput value={form.toll} onChange={(value) => set('toll', value)} /></Field>
              <Field label="Tyre & Service"><MoneyInput value={form.perKmUpkeep} onChange={(value) => set('perKmUpkeep', value)} suffix="/km" /></Field>
              <Field label="Days"><MoneyInput prefix="" suffix="days" value={form.days} onChange={(value) => set('days', value)} /></Field>
              <Field label="Driver + Bata"><MoneyInput value={form.driverPerDay} onChange={(value) => set('driverPerDay', value)} suffix="/day" /></Field>
              <Field label="EMI / Insurance"><MoneyInput value={form.fixedPerDay} onChange={(value) => set('fixedPerDay', value)} suffix="/day" /></Field>
              <Field label="Loading / Unloading"><MoneyInput value={form.loading} onChange={(value) => set('loading', value)} /></Field>
              <Field label="Other"><MoneyInput value={form.otherCost} onChange={(value) => set('otherCost', value)} /></Field>
              <Field label="Profit Margin"><MoneyInput prefix="" suffix="%" value={form.marginPercent} onChange={(value) => set('marginPercent', value)} /></Field>
            </div>
          </FormSection>
        </div>

        <div className="space-y-3">
          <section className="grid grid-cols-2 gap-2 md:gap-3">
            <StatCard compact icon={IndianRupee} tone="rose" label="Trip Cost" value={formatRupees(Math.round(result.cost))} hint={`${formatRupees(result.costPerKm.toFixed(1))}/km run`} />
            <StatCard compact icon={TrendingUp} tone="emerald" label="Quote Price" value={formatRupees(Math.ceil(result.price))} hint={`Profit ${formatRupees(Math.round(result.profit))}`} />
            <StatCard compact icon={Scale} tone="indigo" label="Rate per Ton" value={result.pricePerTon ? formatRupees(Math.ceil(result.pricePerTon)) : '—'} hint={result.costPerTon ? `Cost ${formatRupees(Math.round(result.costPerTon))}/ton` : 'Enter the load'} />
            <StatCard compact icon={Route} tone="blue" label="Rate per KM" value={result.pricePerKm ? formatRupees(result.pricePerKm.toFixed(1)) : '—'} hint="On the loaded distance" />
          </section>

          <section className="card">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800"><Fuel size={16} /> Cost Breakup · {formatNumber(result.km, 0)} km</h2>
            {result.lines.map((line) => (
              <div key={line.label} className="flex justify-between py-1 text-sm">
                <span className="text-slate-600">{line.label}</span>
                <span className="font-semibold text-slate-800">{formatRupees(Math.round(line.value))}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 text-sm font-bold">
              <span>Total cost</span><span className="text-rose-700">{formatRupees(Math.round(result.cost))}</span>
            </div>
            <div className="flex justify-between py-1 text-sm font-bold">
              <span>+ {form.marginPercent || 0}% margin</span><span className="text-emerald-700">{formatRupees(Math.ceil(result.price))}</span>
            </div>
          </section>

          <section className="card space-y-2">
            <h2 className="text-sm font-bold text-slate-800">Make a Quotation</h2>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => makeQuotation('per_trip')} disabled={!result.price}>Per Trip</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => makeQuotation('per_ton')} disabled={!result.pricePerTon}>Per Ton</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => makeQuotation('per_km')} disabled={!result.pricePerKm}>Per KM</button>
            </div>
          </section>
        </div>
      </div>
    </Page>
  );
}
