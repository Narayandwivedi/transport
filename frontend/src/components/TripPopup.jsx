import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Package, PackageCheck, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useMasters from '../utils/useMasters';
import { useAuth } from '../context/AuthContext';
import { TRIP_BASIS_OPTIONS, calcAmount, getBasisUnit } from '../utils/constants';
import { formatNumber, formatRupees, idOf, toDayInput, todayInput, toNumber } from '../utils/format';
import FormPopup from './FormPopup';
import FormSection, { AddLink, FieldGrid } from './FormSection';
import MaterialPopup from './MaterialPopup';
import PartyPopup from './PartyPopup';
import EmployeePopup from './payroll/EmployeePopup';
import { DriverSelect, PartySelect, VehicleSelect } from './Pickers';
import { Field, MoneyInput } from './ui';
import VehiclePopup from './VehiclePopup';

// The five ways to charge, as shown in the picker (per trip is the fixed amount)
const CHARGE_TYPES = [
  { value: 'per_trip', label: 'Per Trip (Fixed)' },
  { value: 'per_km', label: 'Per KM' },
  { value: 'per_ton', label: 'Per Ton' },
  { value: 'per_ton_km', label: 'Per Ton per KM' },
  { value: 'per_cft', label: 'Per Cubic Feet' },
];

// What the quantity box asks for under each way of charging (per ton per km: the tons; the km has its own box)
const QUANTITY_LABELS = { per_trip: 'Trips', per_km: 'Distance', per_ton: 'Weight', per_ton_km: 'Weight', per_cft: 'Cubic Feet' };
const QUANTITY_PLACEHOLDERS = { per_trip: '1', per_km: 'How many km', per_ton: 'Tons loaded', per_ton_km: 'Tons loaded', per_cft: 'How many cubic feet' };
const QUANTITY_UNITS = { per_ton_km: 'ton' };

// How the party paid what it paid on the trip (the rest stays owed in its ledger)
const RECEIVED_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank' },
  { value: 'cheque', label: 'Cheque' },
];

// The kinds of spend on the way, for now
const EXPENSE_TYPES = ['Tyre Puncture', 'Toll', 'Other'];
const EMPTY_EXPENSE = { category: '', amount: '', notes: '' };

const EMPTY = {
  date: todayInput(), vehicleId: '', partyId: '', from: '', to: '', material: '', materialBy: 'party', materialAmount: '',
  materialSupplierId: '', materialCost: '', materialCostPaid: '', materialCostMode: 'cash',
  billingBasis: 'per_trip', quantity: '1', rate: '', distanceKm: '',
  driverId: '', hireBasis: '', hireQuantity: '', hireRate: '', expenses: [EMPTY_EXPENSE], status: 'completed', notes: '',
  receivedAmount: '', receivedMode: 'cash',
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
  distanceKm: trip.distanceKm || '',
  materialBy: trip.materialBy || 'party',
  materialAmount: trip.materialAmount || '',
  materialSupplierId: idOf(trip.materialSupplierId),
  materialCost: trip.materialCost || '',
  materialCostPaid: trip.materialSupplierId && trip.materialCostPaid ? String(trip.materialCostPaid) : '',
  materialCostMode: trip.materialCostMode || 'cash',
  hireQuantity: trip.hireQuantity || '',
  hireRate: trip.hireRate || '',
  driverId: idOf(trip.driverId),
  receivedAmount: trip.receivedAmount ? String(trip.receivedAmount) : '',
  receivedMode: trip.receivedMode || 'cash',
  // Always at least one expense row to fill
  expenses: trip.expenses?.length ? trip.expenses.map((row) => ({ category: row.category, amount: row.amount || '', notes: row.notes || '' })) : [EMPTY_EXPENSE],
});

// "25 ton × ₹900", "30 ton × 100 km × ₹4" or "Fixed"
const sumText = (basis, quantity, rate, km) => {
  if (basis === 'fixed') return 'Fixed amount';
  if (basis === 'per_ton_km') return `${formatNumber(toNumber(quantity), 3)} ton × ${formatNumber(toNumber(km), 0)} km × ${formatRupees(rate)}`;
  if (basis === 'per_trip' && toNumber(quantity) === 1) return 'Total Amount';
  const unit = getBasisUnit(basis);
  const qty = toNumber(quantity);
  const unitLabel = unit === 'km' || unit === 'cft' || qty === 1 ? unit : `${unit}s`;
  return `${formatNumber(qty, 3)} ${unitLabel} × ${formatRupees(rate)}`;
};


/**
 * A trip billed to a party. First how it is charged, then only what that needs:
 * per trip: From (location A) → To (location B), typed or tapped from the vehicle's saved routes, and the trips; per km: the km and the rate;
 * per ton: the weight and the rate. On a hired vehicle paid per trip / km / ton, the owner's share is worked out too.
 */
export default function TripPopup({ trip = null, preset = {}, onClose, onSaved }) {
  const { vehicles, parties, reload: reloadMasters } = useMasters();
  // Staff pick from the drivers the owner added; they cannot add one
  const { isStaff } = useAuth();
  const [form, setForm] = useState(() => (trip ? fromTrip(trip) : { ...EMPTY, ...preset }));
  // Which field a new party is added for: Bill To ('partyId') or Bought From ('materialSupplierId')
  const [addingParty, setAddingParty] = useState(null);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [saving, setSaving] = useState(false);
  // Materials we supply, for the dropdown when we supply material
  const [materials, setMaterials] = useState([]);
  const [addingMaterial, setAddingMaterial] = useState(false);
  // Drivers come from employees with work "driver"
  const [drivers, setDrivers] = useState([]);
  const [addingDriver, setAddingDriver] = useState(false);
  const loadDrivers = async () => {
    const list = await apiClient.get('/payroll/employees', { params: { role: 'driver' } }).catch(() => []);
    const rows = Array.isArray(list) ? list : [];
    setDrivers(rows);
    return rows;
  };
  useEffect(() => {
    loadDrivers();
  }, []);
  // Working drivers, plus the trip's own driver even if they have since left
  const driverOptions = drivers.filter((driver) => driver.isActive || driver._id === form.driverId);
  // The driver who works on a vehicle
  const driverOf = (vehicleId, list = drivers) => list.find((driver) => driver.isActive && idOf(driver.vehicleId) === vehicleId)?._id || '';
  const loadMaterials = async () => {
    const list = await apiClient.get('/materials').catch(() => []);
    setMaterials(Array.isArray(list) ? list : []);
  };
  useEffect(() => {
    loadMaterials();
  }, []);
  // An older trip (or one typed before switching) may hold a material not in the list: keep it pickable
  const materialNames = materials.map((item) => item.name);
  const typedMaterial = String(form.material || '').trim();
  const materialOptions = typedMaterial && !materialNames.some((name) => name.toLowerCase() === typedMaterial.toLowerCase())
    ? [...materialNames, typedMaterial]
    : materialNames;

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

  // A new way of charging keeps the route typed but starts a fresh quantity and rate, with the vehicle's own hire terms
  const changeBasis = (nextBasis) => {
    if (nextBasis === basis) return;
    setForm((prev) => {
      const quantity = nextBasis === 'per_trip' ? '1' : '';
      return { ...prev, billingBasis: nextBasis, quantity, rate: '', distanceKm: '', ...hireDefaults(vehicle, nextBasis, quantity) };
    });
  };

  // A new trip opens with the vehicle list open; picking the vehicle opens the driver list, then Bill To
  const [vehicleSignal] = useState(() => (!trip && !preset.vehicleId ? 1 : 0));
  const [driverSignal, setDriverSignal] = useState(0);
  const [billToSignal, setBillToSignal] = useState(0);
  const pickDriver = (value) => {
    set('driverId', value);
    setBillToSignal((count) => count + 1);
  };

  // `fresh` is a vehicle just added from here, not yet in the loaded list this render sees
  const pickVehicle = (vehicleId, fresh = null) => {
    const picked = fresh || vehicles.find((item) => item._id === vehicleId);
    if (vehicleId) setDriverSignal((count) => count + 1);
    setForm((prev) => {
      const next = { ...prev, vehicleId, ...hireDefaults(picked, prev.billingBasis, prev.quantity) };
      // The vehicle's own driver, unless one is already picked
      if (!prev.driverId) next.driverId = driverOf(vehicleId);
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

  const amount = calcAmount(basis, form.quantity, form.rate, form.distanceKm);
  // The tons and km the party is charged on, when its basis gives them
  const partyTons = basis === 'per_ton' || basis === 'per_ton_km' ? form.quantity : null;
  const partyKm = { per_km: form.quantity, per_ton_km: form.distanceKm }[basis] ?? null;
  // The owner is paid on the same tons / km as the party; per trip is one trip's pay; anything else is asked
  const hireBasis = form.hireBasis;
  let hireQuantity = form.hireQuantity;
  let hireQuantityAsked = false;
  if (hireBasis === basis) hireQuantity = form.quantity;
  else if (hireBasis === 'per_trip') hireQuantity = '1';
  else if ((hireBasis === 'per_ton' || hireBasis === 'per_ton_km') && partyTons !== null) hireQuantity = partyTons;
  else if (hireBasis === 'per_km' && partyKm !== null) hireQuantity = partyKm;
  else hireQuantityAsked = hireBasis !== 'fixed';
  const hireKm = partyKm ?? form.distanceKm;
  const hireAmount = isHired && hireBasis ? calcAmount(hireBasis, hireQuantity, form.hireRate, hireKm) : 0;
  // Material I supply is billed with the transport; margin is on the transport only
  const suppliesMaterial = form.materialBy === 'me';
  const materialAmount = suppliesMaterial ? toNumber(form.materialAmount) : 0;
  const total = amount + materialAmount;
  // Where the material came from: a supplier (paid now, the rest on their account) or cash
  const materialCost = suppliesMaterial ? toNumber(form.materialCost) : 0;
  const hasSupplier = suppliesMaterial && Boolean(form.materialSupplierId);
  const materialCostPaid = hasSupplier ? toNumber(form.materialCostPaid) : materialCost;
  const supplierDue = Math.max(0, materialCost - materialCostPaid);
  const materialProfit = materialAmount - materialCost;
  const partyName = (id) => parties.find((party) => party._id === id)?.name || '';
  // Trip expenses: toll, puncture and the like, booked against the vehicle
  const expenseTotal = form.expenses.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const setExpense = (index, field, value) => setForm((prev) => ({
    ...prev,
    expenses: prev.expenses.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
  }));
  const addExpense = () => setForm((prev) => ({ ...prev, expenses: [...prev.expenses, EMPTY_EXPENSE] }));
  const filledExpenses = form.expenses.filter((row) => toNumber(row.amount) > 0).length;
  const removeExpense = (index) => setForm((prev) => ({ ...prev, expenses: prev.expenses.filter((_, i) => i !== index) }));
  // Profit on the transport: what the party pays for it, less the owner's pay and the trip's expenses
  const margin = amount - hireAmount - expenseTotal;
  // Paid now on the trip: nothing = credit, part = partial, all = fully paid
  const received = toNumber(form.receivedAmount);
  const balanceDue = Math.max(0, total - received);
  let paymentLabel = 'Credit trip';
  if (received > 0) paymentLabel = received >= total ? 'Fully paid' : 'Partial payment';

  const handleSubmit = async () => {
    if (!String(form.from || '').trim() || !String(form.to || '').trim()) {
      toast.error('Enter the route: From (location A) → To (location B)');
      return;
    }
    if (form.expenses.some((row) => toNumber(row.amount) > 0 && !row.category)) {
      toast.error('Pick the type of each expense');
      return;
    }
    if (suppliesMaterial && !String(form.material || '').trim()) {
      toast.error('Enter which material you supplied');
      return;
    }
    if (hasSupplier && materialCostPaid > materialCost) {
      toast.error('Paid to the supplier cannot be more than the buy cost');
      return;
    }
    if (received > total) {
      toast.error('Received cannot be more than the bill. Enter any extra in Money Received.');
      return;
    }
    setSaving(true);
    try {
      // distanceKm carries the km of a per ton per km charge, the party's or the owner's
      const distanceKm = basis === 'per_ton_km' || (isHired && hireBasis === 'per_ton_km') ? hireKm : 0;
      const payload = { ...form, hireQuantity, distanceKm, receivedAmount: received, materialCostPaid };
      const saved = trip ? await apiClient.put(`/trips/${trip._id}`, payload) : await apiClient.post('/trips', payload);
      // A staff save with "save on approval" waits for the owner
      toast.success(saved?.pendingApproval ? 'Sent to the owner for approval' : trip ? 'Trip updated' : 'Trip added');
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
  const quantityUnit = QUANTITY_UNITS[basis] || unit;
  const hireQuantityUnit = QUANTITY_UNITS[form.hireBasis] || hireUnit;
  // One entry is one trip, so per trip never asks how many (an old trip saved with more still shows it)
  const askQuantity = basis !== 'per_trip' || toNumber(form.quantity) !== 1;
  // The owner's tons / km are asked only when the party's charge does not give them, and never per trip
  const askHireQuantity = Boolean(hireBasis) && hireQuantityAsked;
  // Owner paid per ton per km on a trip that gives no km: ask the km
  const askHireKm = hireBasis === 'per_ton_km' && partyKm === null;

  const routeLabel = (route) => `${route.from} → ${route.to}`;

  return (
    <>
      <FormPopup
        title={trip ? `Edit Trip ${trip.tripNo}` : 'Add Trip'}
        subtitle="Bill a party per trip, km, ton, ton per km or cubic feet"
        maxWidth="max-w-4xl"
        onClose={onClose}
        onSubmit={handleSubmit}
        submitDisabled={saving}
        submitLabel={trip ? 'Update' : 'Save Trip'}
        enterToNext
        footerExtra={(
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-xs font-medium text-slate-500">Bill</span>
            <span className="text-base font-bold text-slate-900">{formatRupees(total)}</span>
            {materialAmount > 0 && <span className="text-xs text-slate-500">incl. material {formatRupees(materialAmount)}</span>}
            {received > 0 && <span className="text-xs font-semibold text-emerald-700">Received {formatRupees(received)}</span>}
            {balanceDue > 0 && total > 0 && <span className="text-xs font-semibold text-amber-700">Due {formatRupees(balanceDue)}</span>}
            {(hireAmount > 0 || expenseTotal > 0) && (
              <span className={`text-xs font-semibold ${margin >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>Profit {formatRupees(margin)}</span>
            )}
          </div>
        )}
      >
        {/* 1. Who and when */}
        <FormSection number={1} title="Trip Details" tone="blue">
          {/* Row 1: Date and Vehicle · Row 2: Driver and Bill To */}
          <FieldGrid cols={2}>
            <Field label="Date" required htmlFor="trip-date">
              <input id="trip-date" type="date" className="input" value={form.date} onChange={(event) => set('date', event.target.value)} required />
            </Field>
            <Field label="Vehicle" required actionNextToLabel action={!isStaff && <AddLink onClick={() => setAddingVehicle(true)}>New Vehicle</AddLink>}>
              <VehicleSelect vehicles={vehicles} value={form.vehicleId} onChange={(value) => pickVehicle(value)} required openSignal={vehicleSignal} />
            </Field>
            <Field label="Driver" htmlFor="trip-driver" action={!isStaff && <AddLink onClick={() => setAddingDriver(true)}>New Driver</AddLink>}>
              <DriverSelect id="trip-driver" drivers={driverOptions} value={form.driverId} onChange={pickDriver} emptyLabel="No driver" openSignal={driverSignal} />
            </Field>
            <Field label="Bill To" required action={<AddLink onClick={() => setAddingParty('partyId')}>New Party</AddLink>}>
              <PartySelect parties={parties} value={form.partyId} onChange={(value) => set('partyId', value)} prefer={['customer']} required openSignal={billToSignal} />
            </Field>
          </FieldGrid>
        </FormSection>

        {/* 2. Route and how the party is charged */}
        <FormSection number={2} title="Route & Charge" tone="sky">
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

          {/* Every trip records where the vehicle went: From → To */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <Field label="From" required htmlFor="trip-from">
              <input id="trip-from" className="input" value={form.from} onChange={(event) => typeRoute('from', event.target.value)} placeholder="Location A" autoComplete="off" required />
            </Field>
            <ArrowRight size={16} className="mb-3 text-slate-400" />
            <Field label="To" required htmlFor="trip-to">
              <input id="trip-to" className="input" value={form.to} onChange={(event) => typeRoute('to', event.target.value)} placeholder="Location B" autoComplete="off" required />
            </Field>
          </div>

          <div className={`grid gap-3 md:gap-4 ${basis === 'per_ton_km' ? 'grid-cols-2 sm:grid-cols-4' : askQuantity ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
            {/* How the party is charged, then the rate, then how much */}
            <Field label="Charge By" required htmlFor="trip-basis">
              {/* A plain dropdown; Enter from To opens its list (data-open-on-enter), picking moves on to the rate */}
              <select id="trip-basis" className="input" value={basis} onChange={(event) => changeBasis(event.target.value)} required data-open-on-enter="">
                {CHARGE_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label={basis === 'per_trip' ? 'Trip Amount' : basis === 'per_ton_km' ? 'Rate per Ton per KM' : basis === 'per_cft' ? 'Rate per Cubic Foot' : `Rate per ${unit}`} required>
              <MoneyInput value={form.rate} onChange={(value) => set('rate', value)} suffix={unit ? `/${unit}` : ''} required />
            </Field>
            {askQuantity && (
              <Field label={QUANTITY_LABELS[basis]} required>
                <MoneyInput prefix="" suffix={quantityUnit} value={form.quantity} onChange={(value) => set('quantity', value)} placeholder={QUANTITY_PLACEHOLDERS[basis]} required />
              </Field>
            )}
            {basis === 'per_ton_km' && (
              <Field label="Distance" required>
                <MoneyInput prefix="" suffix="km" value={form.distanceKm} onChange={(value) => set('distanceKm', value)} placeholder="How many km" required />
              </Field>
            )}
          </div>

          <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 ring-1 transition ${amount > 0 ? 'bg-emerald-50 ring-emerald-200' : 'bg-slate-50 ring-slate-200'}`}>
            <span className={`text-sm ${amount > 0 ? 'text-emerald-800' : 'text-slate-500'}`}>
              {sumText(basis, form.quantity, form.rate, form.distanceKm)}
              {onSavedRoute && toNumber(form.rate) === toNumber(routes[routeIndex].rate) && <span className="ml-2 text-xs text-emerald-600">saved rate</span>}
            </span>
            <span className={`text-lg font-bold ${amount > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{formatRupees(amount)}</span>
          </div>
        </FormSection>

        {/* 3. Material: loaded by the party (usual), or supplied by me and billed with the transport */}
        <FormSection number={3} title="Material" tone="emerald">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/70 p-1 ring-1 ring-emerald-200">
            {[
              { value: 'party', label: 'Party loads own material', icon: Package },
              { value: 'me', label: 'We supply material', icon: PackageCheck },
            ].map(({ value, label, icon: Icon }) => {
              const active = form.materialBy === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('materialBy', value)}
                  aria-pressed={active}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-xs font-semibold transition md:text-sm ${active ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}
                >
                  <Icon size={16} className="hidden sm:block" /> {label}
                </button>
              );
            })}
          </div>

          {suppliesMaterial ? (
            <>
              {/* What, and where it was bought */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
                <Field label="Which material" required htmlFor="trip-material" actionNextToLabel action={<AddLink onClick={() => setAddingMaterial(true)}>New Material</AddLink>}>
                  <select id="trip-material" className="input" value={form.material} onChange={(event) => set('material', event.target.value)} required>
                    <option value="">Select material</option>
                    {materialOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </Field>
                <Field label="Bought From" hint="The party you bought it from, or Cash" actionNextToLabel action={<AddLink onClick={() => setAddingParty('materialSupplierId')}>Add Party</AddLink>}>
                  <PartySelect parties={parties} value={form.materialSupplierId} onChange={(value) => set('materialSupplierId', value)} prefer={['supplier']} allowEmpty emptyLabel="Cash" />
                </Field>
              </div>

              {/* Buy and sell */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <Field label="Buy Cost" hint={hasSupplier ? `What you pay ${partyName(form.materialSupplierId)}` : 'What you paid for it'}>
                  <MoneyInput value={form.materialCost} onChange={(value) => set('materialCost', value)} placeholder="0" />
                </Field>
                <Field label="Selling Price" required hint={form.partyId ? `Billed to ${partyName(form.partyId)}` : 'Billed to the Bill To party'}>
                  <MoneyInput value={form.materialAmount} onChange={(value) => set('materialAmount', value)} required />
                </Field>
              </div>

              {/* Paying the supplier: now, or later from their ledger */}
              {hasSupplier && materialCost > 0 && (
                <div className={`grid gap-3 md:gap-4 ${materialCostPaid > 0 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  <Field label="Paid to Supplier Now" action={<AddLink onClick={() => set('materialCostPaid', String(materialCost))}>Full amount</AddLink>}>
                    <MoneyInput value={form.materialCostPaid} onChange={(value) => set('materialCostPaid', value)} placeholder="0 (on their account)" />
                  </Field>
                  {materialCostPaid > 0 && (
                    <Field label="Paid By" htmlFor="trip-material-mode">
                      <select id="trip-material-mode" className="input" value={form.materialCostMode} onChange={(event) => set('materialCostMode', event.target.value)}>
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="bank">Bank</option>
                      </select>
                    </Field>
                  )}
                </div>
              )}

              {/* Summary: bought from → sold to, and the material's profit */}
              <div className="space-y-1.5 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm ring-1 ring-emerald-200">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-emerald-900">
                  <span>
                    Bought from <b>{hasSupplier ? partyName(form.materialSupplierId) : 'Cash'}</b> {formatRupees(materialCost)}
                    <ArrowRight size={13} className="mx-1.5 inline" />
                    Sold to <b>{partyName(form.partyId) || 'Bill To party'}</b> {formatRupees(materialAmount)}
                  </span>
                  {materialCost > 0 && (
                    <span className={`font-semibold ${materialProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      Material {materialProfit >= 0 ? 'profit' : 'loss'} {formatRupees(Math.abs(materialProfit))}
                    </span>
                  )}
                </div>
                {hasSupplier && supplierDue > 0 && (
                  <p className="text-xs text-amber-800">{formatRupees(supplierDue)} goes on {partyName(form.materialSupplierId)}&apos;s account (their ledger).</p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-x-4 border-t border-emerald-200 pt-1.5">
                  <span className="text-emerald-800">Transport {formatRupees(amount)} + Material {formatRupees(materialAmount)}</span>
                  <span className={`text-lg font-bold ${total > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{formatRupees(total)}</span>
                </div>
              </div>
            </>
          ) : (
            <Field label="Material (optional)" htmlFor="trip-material">
              <input id="trip-material" className="input" value={form.material} onChange={(event) => set('material', event.target.value)} placeholder="Cement, coal, sand…" />
            </Field>
          )}
        </FormSection>

        {/* 4. How much the party paid on this trip */}
        <FormSection number={4} title="Payment from Party" tone="indigo" hint="What is not paid now stays due in the party's ledger.">
          {/* Total, then what is paid now; nothing paid = credit */}
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 ${received > 0 ? 'md:grid-cols-3' : ''}`}>
            <Field label="Total Amount">
              <div className="input flex items-center bg-slate-50 font-bold text-slate-900">{formatRupees(total)}</div>
            </Field>
            <Field label="Pay Now" htmlFor="trip-pay-now" action={total > 0 && <AddLink onClick={() => set('receivedAmount', String(total))}>Full amount</AddLink>}>
              <MoneyInput id="trip-pay-now" value={form.receivedAmount} onChange={(value) => set('receivedAmount', value)} placeholder="0 (credit)" />
            </Field>
            {/* Which way the money came only matters when some was paid */}
            {received > 0 && (
              <Field label="Received In" htmlFor="trip-received-mode">
                <select id="trip-received-mode" className="input" value={form.receivedMode} onChange={(event) => set('receivedMode', event.target.value)}>
                  {RECEIVED_MODES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
            )}
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl px-4 py-2.5 ring-1 ${balanceDue > 0 ? 'bg-amber-50 ring-amber-200' : 'bg-emerald-50 ring-emerald-200'}`}>
            <span className={`text-sm font-semibold ${balanceDue > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
              {paymentLabel}
              {received > total && <span className="ml-2 text-rose-700">more than the bill</span>}
            </span>
            <span className={`text-sm font-semibold ${balanceDue > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
              Balance: <span className="text-lg font-bold">{formatRupees(balanceDue)}</span>
            </span>
          </div>
        </FormSection>

        {/* 5. What the owner of a hired vehicle gets */}
        {isHired && (
          <FormSection
            number={5}
            tone="amber"
            title={`Owner Payment · ${vehicle?.ownerPartyId?.name || 'Hired vehicle'}`}
            action={(
              <select className="input h-9 min-h-0 w-auto py-0 text-xs md:text-sm" value={form.hireBasis} onChange={(event) => set('hireBasis', event.target.value)} aria-label="Pay owner">
                <option value="">Monthly hire (no trip pay)</option>
                {TRIP_BASIS_OPTIONS.map((option) => <option key={option.value} value={option.value}>Pay {option.label}</option>)}
              </select>
            )}
          >
            {form.hireBasis ? (
              <>
                <div className={`grid gap-3 ${askHireQuantity && askHireKm ? 'grid-cols-1 sm:grid-cols-3' : askHireQuantity || askHireKm ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <Field label={form.hireBasis === 'fixed' ? 'Owner amount' : form.hireBasis === 'per_ton_km' ? 'Owner rate per Ton per KM' : form.hireBasis === 'per_cft' ? 'Owner rate per Cubic Foot' : `Owner rate per ${hireUnit}`}>
                    <MoneyInput value={form.hireRate} onChange={(value) => set('hireRate', value)} suffix={hireUnit ? `/${hireUnit}` : ''} />
                  </Field>
                  {askHireQuantity && (
                    <Field label={QUANTITY_LABELS[form.hireBasis]}>
                      <MoneyInput prefix="" suffix={hireQuantityUnit} value={form.hireQuantity} onChange={(value) => set('hireQuantity', value)} />
                    </Field>
                  )}
                  {askHireKm && (
                    <Field label="Distance">
                      <MoneyInput prefix="" suffix="km" value={form.distanceKm} onChange={(value) => set('distanceKm', value)} placeholder="How many km" />
                    </Field>
                  )}
                </div>
                <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 ring-1 ${hireAmount > 0 ? 'bg-amber-50 ring-amber-200' : 'bg-slate-50 ring-slate-200'}`}>
                  <span className={`text-sm ${hireAmount > 0 ? 'text-amber-800' : 'text-slate-500'}`}>{sumText(form.hireBasis, hireQuantity, form.hireRate, hireKm)}</span>
                  <span className={`text-lg font-bold ${hireAmount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{formatRupees(hireAmount)}</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">Rent for this vehicle is counted from Monthly Hire, not on each trip.</p>
            )}
          </FormSection>
        )}

        {/* 4 or 5. Spends on the way: toll, puncture… each saved as an expense of the vehicle */}
        <FormSection
          number={isHired ? 6 : 5}
          title="Trip Expenses"
          tone="rose"
          action={<AddLink onClick={() => addExpense()}>Add Expense</AddLink>}
        >
          {/* Two boxes per expense: type, then amount */}
          <div className="space-y-2">
            {form.expenses.map((row, index) => (
              <div key={index} className={`grid items-end gap-2 sm:gap-3 ${form.expenses.length > 1 ? 'grid-cols-[1fr_1fr_auto]' : 'grid-cols-2'}`}>
                <Field label="Expense Type" htmlFor={`trip-expense-${index}`}>
                  <select id={`trip-expense-${index}`} className="input" value={row.category} onChange={(event) => setExpense(index, 'category', event.target.value)}>
                    <option value="">Select type</option>
                    {/* An older trip may hold a type no longer listed */}
                    {[...EXPENSE_TYPES, ...(row.category && !EXPENSE_TYPES.includes(row.category) ? [row.category] : [])].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Amount">
                  <MoneyInput value={row.amount} onChange={(value) => setExpense(index, 'amount', value)} />
                </Field>
                {form.expenses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExpense(index)}
                    aria-label="Remove expense"
                    className="mb-0.5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {expenseTotal > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl bg-rose-50 px-4 py-2.5 ring-1 ring-rose-200">
              <span className="text-sm text-rose-800">
                {filledExpenses} expense{filledExpenses === 1 ? '' : 's'} · counted in this vehicle&apos;s costs
              </span>
              <span className="text-lg font-bold text-rose-700">{formatRupees(expenseTotal)}</span>
            </div>
          )}
        </FormSection>

        {/* 6 or 7. Other details */}
        <FormSection number={isHired ? 7 : 6} title="Other Details" tone="slate">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
            <Field label="Status">
              <select className="input" value={form.status} onChange={(event) => set('status', event.target.value)}>
                <option value="planned">Planned</option>
                <option value="running">On the way</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
            <Field label="LR No. / Notes" htmlFor="trip-notes" className="sm:col-span-2">
              <textarea id="trip-notes" rows={2} className="input resize-none" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="LR number or any additional notes…" />
            </Field>
          </div>
        </FormSection>
      </FormPopup>

      {addingVehicle && (
        <VehiclePopup
          onClose={() => setAddingVehicle(false)}
          onSaved={async (saved) => {
            await reloadMasters();
            if (saved?._id) pickVehicle(saved._id, saved);
          }}
        />
      )}

      {addingDriver && (
        <EmployeePopup
          defaultRole="driver"
          defaultVehicleId={form.vehicleId}
          onClose={() => setAddingDriver(false)}
          onSaved={async (driver) => {
            await loadDrivers();
            if (driver?._id) set('driverId', driver._id);
          }}
        />
      )}

      {addingMaterial && (
        <MaterialPopup
          onClose={() => setAddingMaterial(false)}
          onSaved={async (material) => {
            await loadMaterials();
            set('material', material.name);
          }}
        />
      )}

      {addingParty && (
        <PartyPopup
          // A party added for Bought From starts as a supplier
          defaultType={addingParty === 'materialSupplierId' ? 'supplier' : 'customer'}
          onClose={() => setAddingParty(null)}
          onSaved={async (party) => {
            await reloadMasters();
            if (party?._id) set(addingParty, party._id);
          }}
        />
      )}
    </>
  );
}
