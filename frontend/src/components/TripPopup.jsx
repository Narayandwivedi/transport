import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Gauge, Route, Weight } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useMasters from '../utils/useMasters';
import { BILLING_BASIS_OPTIONS, calcAmount, getBasisUnit } from '../utils/constants';
import { formatNumber, formatRupees, idOf, toDayInput, todayInput, toNumber } from '../utils/format';
import FormPopup from './FormPopup';
import FormSection, { AddLink, FieldGrid } from './FormSection';
import PartyPopup from './PartyPopup';
import { PartySelect, VehicleSelect } from './Pickers';
import { Field, MoneyInput } from './ui';

// The three ways to charge, as shown in the picker (per trip is the fixed amount)
const CHARGE_TYPES = [
  { value: 'per_trip', label: 'Per Trip (Fixed)', icon: Route },
  { value: 'per_km', label: 'Per KM', icon: Gauge },
  { value: 'per_ton', label: 'Per Ton', icon: Weight },
];

// What the quantity box asks for under each way of charging
const QUANTITY_LABELS = { per_trip: 'Trips', per_km: 'Kilometres', per_ton: 'Weight' };
const QUANTITY_PLACEHOLDERS = { per_trip: '1', per_km: 'How many km', per_ton: 'Tons loaded' };

const EMPTY = {
  date: todayInput(), vehicleId: '', partyId: '', from: '', to: '', material: '',
  billingBasis: 'per_trip', quantity: '1', rate: '',
  hireBasis: '', hireQuantity: '', hireRate: '', driverAdvance: '', status: 'completed', notes: '',
};

// Routes match without caring about capitals or extra spaces
const routeKey = (row) => `${String(row.from || '').trim().toLowerCase()}|${String(row.to || '').trim().toLowerCase()}`;
const basisOf = (route) => route.basis || 'per_trip';
const findRoute = (vehicle, row) => (vehicle?.routeRates || []).find((route) => routeKey(route) === routeKey(row));

/**
 * A route of the vehicle: charged its way (per trip, per km or per ton) at its rate, and for a hired vehicle
 * the owner paid the same way at the owner's rate. Per km takes the route's distance; per ton keeps the weight typed.
 */
const applyRoute = (form, route, vehicle) => {
  const basis = basisOf(route);
  let quantity;
  if (basis === 'per_trip') quantity = '1';
  else if (basis === 'per_km') quantity = route.distanceKm ? String(route.distanceKm) : form.billingBasis === 'per_km' ? form.quantity : '';
  else quantity = form.billingBasis === 'per_ton' ? form.quantity : '';
  const next = { ...form, from: route.from, to: route.to, billingBasis: basis, quantity, rate: String(route.rate || '') };
  if (vehicle?.ownership === 'hired' && route.hireRate > 0) {
    Object.assign(next, { hireBasis: basis, hireQuantity: quantity, hireRate: String(route.hireRate) });
  }
  return next;
};

// A hired vehicle's own agreed pay, for a trip charged a given way
const hireDefaults = (vehicle, basis, quantity) => {
  if (vehicle?.ownership !== 'hired' || !vehicle.hireBasis) return { hireBasis: '', hireQuantity: '', hireRate: '' };
  let hireQuantity = '';
  if (vehicle.hireBasis === basis) hireQuantity = quantity;
  else if (vehicle.hireBasis === 'per_trip') hireQuantity = '1';
  return { hireBasis: vehicle.hireBasis, hireQuantity, hireRate: vehicle.hireRate ? String(vehicle.hireRate) : '' };
};

const fromTrip = (trip) => ({
  ...EMPTY,
  ...trip,
  // Old trips saved as a fixed amount open as one trip at that amount
  ...(trip.billingBasis === 'fixed' ? { billingBasis: 'per_trip', quantity: 1 } : {}),
  date: toDayInput(trip.date),
  vehicleId: idOf(trip.vehicleId),
  partyId: idOf(trip.partyId),
  hireQuantity: trip.hireQuantity || '',
  hireRate: trip.hireRate || '',
  driverAdvance: trip.driverAdvance || '',
});

// "25 ton × ₹900" or "Fixed"
const sumText = (basis, quantity, rate) => {
  if (basis === 'fixed') return 'Fixed amount';
  if (basis === 'per_trip' && toNumber(quantity) === 1) return 'Total Amount';
  const unit = getBasisUnit(basis);
  const qty = toNumber(quantity);
  const unitLabel = unit === 'km' || qty === 1 ? unit : `${unit}s`;
  return `${formatNumber(qty, 3)} ${unitLabel} × ${formatRupees(rate)}`;
};


/**
 * A trip billed to a party. First how it is charged, then only what that needs:
 * per trip: From (location A) → To (location B), typed or tapped from the vehicle's saved routes, and the trips; per km: the km and the rate;
 * per ton: the weight and the rate. On a hired vehicle paid per trip / km / ton, the owner's share is worked out too.
 */
export default function TripPopup({ trip = null, preset = {}, onClose, onSaved }) {
  const { vehicles, parties, reload: reloadParties } = useMasters();
  const [form, setForm] = useState(() => (trip ? fromTrip(trip) : { ...EMPTY, ...preset }));
  const [addingParty, setAddingParty] = useState(false);
  const [saving, setSaving] = useState(false);

  const vehicle = vehicles.find((item) => item._id === form.vehicleId);
  const isHired = vehicle?.ownership === 'hired';
  const basis = form.billingBasis;
  const routes = (vehicle?.routeRates || []).filter((route) => basisOf(route) === basis);
  const routeIndex = routes.findIndex((route) => routeKey(route) === routeKey(form));
  const onSavedRoute = routeIndex !== -1;

  // Change a field; the owner is paid on the same quantity when both use the same basis
  const set = (field, value) => setForm((prev) => {
    const next = { ...prev, [field]: value };
    if ((field === 'quantity' || field === 'hireBasis') && next.hireBasis === next.billingBasis) next.hireQuantity = next.quantity;
    if (field === 'hireBasis' && value === 'per_trip' && next.billingBasis !== 'per_trip' && !toNumber(next.hireQuantity)) next.hireQuantity = '1';
    return next;
  });

  // A new way of charging starts clean: no route, a fresh quantity and rate, and the vehicle's own hire terms
  const changeBasis = (nextBasis) => {
    if (nextBasis === basis) return;
    setForm((prev) => {
      const quantity = nextBasis === 'per_trip' ? '1' : '';
      return { ...prev, billingBasis: nextBasis, from: '', to: '', quantity, rate: '', ...hireDefaults(vehicle, nextBasis, quantity) };
    });
  };

  const pickVehicle = (vehicleId) => {
    const picked = vehicles.find((item) => item._id === vehicleId);
    setForm((prev) => {
      const next = { ...prev, vehicleId, ...hireDefaults(picked, prev.billingBasis, prev.quantity) };
      // Already on one of this vehicle's routes: take its rate
      const route = findRoute(picked, next);
      return route ? applyRoute(next, route, picked) : next;
    });
  };

  // Tap a saved route chip; tap it again to clear the route
  const pickRoute = (value) => {
    if (value === '') {
      setForm((prev) => ({ ...prev, from: '', to: '' }));
      return;
    }
    setForm((prev) => applyRoute(prev, routes[Number(value)], vehicle));
  };

  // Typing From / To: once it matches one of the vehicle's saved routes charged this way, take that route's rate
  const typeRoute = (field, value) => setForm((prev) => {
    const next = { ...prev, [field]: value };
    const route = findRoute(vehicle, next);
    return route && basisOf(route) === prev.billingBasis ? applyRoute(next, route, vehicle) : next;
  });

  // Opened from a vehicle's page: once vehicles load, fill its hire terms (and a route tapped there)
  const presetApplied = useRef(false);
  useEffect(() => {
    if (trip || !preset.vehicleId || presetApplied.current || !vehicles.length) return;
    presetApplied.current = true;
    pickVehicle(preset.vehicleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  const amount = calcAmount(basis, form.quantity, form.rate);
  // Paid the same way as the party, the owner is paid on the same quantity
  // Paid per trip, the owner gets one trip's pay for this entry
  let hireQuantity = form.hireQuantity;
  if (form.hireBasis === basis) hireQuantity = form.quantity;
  else if (form.hireBasis === 'per_trip') hireQuantity = '1';
  const hireAmount = isHired && form.hireBasis ? calcAmount(form.hireBasis, hireQuantity, form.hireRate) : 0;
  const margin = amount - hireAmount;

  const handleSubmit = async () => {
    if (basis === 'per_trip' && (!String(form.from || '').trim() || !String(form.to || '').trim())) {
      toast.error('Enter the route: From (location A) → To (location B)');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, hireQuantity };
      if (trip) await apiClient.put(`/trips/${trip._id}`, payload);
      else await apiClient.post('/trips', payload);
      toast.success(trip ? 'Trip updated' : 'Trip added');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const unit = getBasisUnit(basis);
  const hireUnit = getBasisUnit(form.hireBasis);
  // Per trip always asks From → To
  const showTypedRoute = basis === 'per_trip';
  // One entry is one trip, so per trip never asks how many (an old trip saved with more still shows it)
  const askQuantity = basis !== 'per_trip' || toNumber(form.quantity) !== 1;
  // The owner's quantity is asked only when they are paid a different way from the party, and never per trip
  const askHireQuantity = form.hireBasis && !['fixed', 'per_trip'].includes(form.hireBasis) && form.hireBasis !== basis;

  const routeLabel = (route) => `${route.from} → ${route.to}`;

  return (
    <>
      <FormPopup
        title={trip ? `Edit Trip ${trip.tripNo}` : 'Add Trip'}
        subtitle="Bill a party per trip, per km or per ton"
        maxWidth="max-w-4xl"
        onClose={onClose}
        onSubmit={handleSubmit}
        submitDisabled={saving}
        submitLabel={trip ? 'Update' : 'Save Trip'}
        footerExtra={(
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-xs font-medium text-slate-500">Bill</span>
            <span className="text-base font-bold text-slate-900">{formatRupees(amount)}</span>
            {hireAmount > 0 && (
              <span className={`text-xs font-semibold ${margin >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>Margin {formatRupees(margin)}</span>
            )}
          </div>
        )}
      >
        {/* 1. Who and when */}
        <FormSection number={1} title="Trip Details" tone="blue">
          <FieldGrid cols={4}>
            <Field label="Date" required htmlFor="trip-date">
              <input id="trip-date" type="date" className="input" value={form.date} onChange={(event) => set('date', event.target.value)} required />
            </Field>
            <Field label="Vehicle" required>
              <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={pickVehicle} required />
            </Field>
            <Field label="Bill To" required action={<AddLink onClick={() => setAddingParty(true)}>New Party</AddLink>} className="sm:col-span-2">
              <PartySelect parties={parties} value={form.partyId} onChange={(value) => set('partyId', value)} prefer={['customer']} required />
            </Field>
          </FieldGrid>
        </FormSection>

        {/* 2. Route and how the party is charged */}
        <FormSection number={2} title="Route & Charge" tone="sky">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/70 p-1 ring-1 ring-sky-200">
            {CHARGE_TYPES.map(({ value, label, icon: Icon }) => {
              const active = basis === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeBasis(value)}
                  aria-pressed={active}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-xs font-semibold transition md:text-sm ${active ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}
                >
                  <Icon size={16} className="hidden sm:block" /> {label}
                </button>
              );
            })}
          </div>

          {routes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500">Saved:</span>
              {routes.map((route, index) => (
                <button
                  key={routeLabel(route)}
                  type="button"
                  onClick={() => pickRoute(index === routeIndex ? '' : String(index))}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition ${index === routeIndex ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-primary-300'}`}
                >
                  {routeLabel(route)} · {formatRupees(route.rate)}/{unit}{route.distanceKm && basis === 'per_km' ? ` · ${formatNumber(route.distanceKm, 0)} km` : ''}{isHired && route.hireRate ? ` · owner ${formatRupees(route.hireRate)}` : ''}
                </button>
              ))}
            </div>
          )}

          {showTypedRoute && (
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <Field label="From" required={basis === 'per_trip'} htmlFor="trip-from">
                <input id="trip-from" className="input" value={form.from} onChange={(event) => typeRoute('from', event.target.value)} placeholder="Location A" autoComplete="off" required={basis === 'per_trip'} />
              </Field>
              <ArrowRight size={16} className="mb-3 text-slate-400" />
              <Field label="To" required={basis === 'per_trip'} htmlFor="trip-to">
                <input id="trip-to" className="input" value={form.to} onChange={(event) => typeRoute('to', event.target.value)} placeholder="Location B" autoComplete="off" required={basis === 'per_trip'} />
              </Field>
            </div>
          )}

          <div className={`grid gap-3 md:gap-4 ${askQuantity ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {askQuantity && (
              <Field label={QUANTITY_LABELS[basis]} required>
                <MoneyInput prefix="" suffix={unit} value={form.quantity} onChange={(value) => set('quantity', value)} placeholder={QUANTITY_PLACEHOLDERS[basis]} required />
              </Field>
            )}
            <Field label={basis === 'per_trip' ? 'Trip Amount' : `Rate per ${unit}`} required>
              <MoneyInput value={form.rate} onChange={(value) => set('rate', value)} suffix={unit ? `/${unit}` : ''} required />
            </Field>
          </div>

          <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 ring-1 transition ${amount > 0 ? 'bg-emerald-50 ring-emerald-200' : 'bg-slate-50 ring-slate-200'}`}>
            <span className={`text-sm ${amount > 0 ? 'text-emerald-800' : 'text-slate-500'}`}>
              {sumText(basis, form.quantity, form.rate)}
              {onSavedRoute && toNumber(form.rate) === toNumber(routes[routeIndex].rate) && <span className="ml-2 text-xs text-emerald-600">saved rate</span>}
            </span>
            <span className={`text-lg font-bold ${amount > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{formatRupees(amount)}</span>
          </div>
        </FormSection>

        {/* 3. What the owner of a hired vehicle gets */}
        {isHired && (
          <FormSection
            number={3}
            tone="amber"
            title={`Owner Payment · ${vehicle?.ownerPartyId?.name || 'Hired vehicle'}`}
            action={(
              <select className="input h-9 min-h-0 w-auto py-0 text-xs md:text-sm" value={form.hireBasis} onChange={(event) => set('hireBasis', event.target.value)} aria-label="Pay owner">
                <option value="">Monthly hire (no trip pay)</option>
                {BILLING_BASIS_OPTIONS.map((option) => <option key={option.value} value={option.value}>Pay {option.label}</option>)}
              </select>
            )}
          >
            {form.hireBasis ? (
              <>
                <div className={`grid gap-3 ${askHireQuantity ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {askHireQuantity && (
                    <Field label={QUANTITY_LABELS[form.hireBasis]}>
                      <MoneyInput prefix="" suffix={hireUnit} value={form.hireQuantity} onChange={(value) => set('hireQuantity', value)} />
                    </Field>
                  )}
                  <Field label={form.hireBasis === 'fixed' ? 'Owner amount' : `Owner rate per ${hireUnit}`}>
                    <MoneyInput value={form.hireRate} onChange={(value) => set('hireRate', value)} suffix={hireUnit ? `/${hireUnit}` : ''} />
                  </Field>
                </div>
                <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 ring-1 ${hireAmount > 0 ? 'bg-amber-50 ring-amber-200' : 'bg-slate-50 ring-slate-200'}`}>
                  <span className={`text-sm ${hireAmount > 0 ? 'text-amber-800' : 'text-slate-500'}`}>{sumText(form.hireBasis, hireQuantity, form.hireRate)}</span>
                  <span className={`text-lg font-bold ${hireAmount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{formatRupees(hireAmount)}</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">Rent for this vehicle is counted from Monthly Hire, not on each trip.</p>
            )}
          </FormSection>
        )}

        {/* 3 or 4. Other details */}
        <FormSection number={isHired ? 4 : 3} title="Other Details" tone="slate">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
            <Field label="Material" htmlFor="trip-material">
              <input id="trip-material" className="input" value={form.material} onChange={(event) => set('material', event.target.value)} placeholder="Cement, coal, sand…" />
            </Field>
            <Field label="Driver Advance">
              <MoneyInput value={form.driverAdvance} onChange={(value) => set('driverAdvance', value)} />
            </Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(event) => set('status', event.target.value)}>
                <option value="planned">Planned</option>
                <option value="running">On the way</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
            <Field label="LR No. / Notes" htmlFor="trip-notes" className="sm:col-span-2 md:col-span-3">
              <textarea id="trip-notes" rows={2} className="input resize-none" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="LR number or any additional notes…" />
            </Field>
          </div>
        </FormSection>
      </FormPopup>

      {addingParty && (
        <PartyPopup
          onClose={() => setAddingParty(false)}
          onSaved={async (party) => {
            await reloadParties();
            set('partyId', party._id);
          }}
        />
      )}
    </>
  );
}
