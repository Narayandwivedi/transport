import { formatNumber, formatRupees } from './format';

// How a trip, a hired vehicle or a quotation line is charged
export const BILLING_BASIS_OPTIONS = [
  { value: 'per_trip', label: 'Per Trip', unit: 'trip' },
  { value: 'per_km', label: 'Per KM', unit: 'km' },
  { value: 'per_ton', label: 'Per Ton', unit: 'ton' },
  { value: 'fixed', label: 'Fixed Amount', unit: '' },
];

export const QUOTE_BASIS_OPTIONS = [...BILLING_BASIS_OPTIONS, { value: 'per_month', label: 'Per Month', unit: 'month' }];

// A trip can also be charged per ton per km (tons × km × rate) or per cubic foot (cft × rate)
const TRIP_ONLY_OPTIONS = [
  { value: 'per_ton_km', label: 'Per Ton per KM', unit: 'ton/km' },
  { value: 'per_cft', label: 'Per Cubic Feet', unit: 'cft' },
];
export const TRIP_BASIS_OPTIONS = [...BILLING_BASIS_OPTIONS, ...TRIP_ONLY_OPTIONS];

const ALL_BASIS_OPTIONS = [...QUOTE_BASIS_OPTIONS, ...TRIP_ONLY_OPTIONS];
export const getBasisLabel = (basis) => ALL_BASIS_OPTIONS.find((option) => option.value === basis)?.label || '—';
export const getBasisUnit = (basis) => ALL_BASIS_OPTIONS.find((option) => option.value === basis)?.unit || '';

// A fixed amount ignores the quantity; per ton per km multiplies the tons, the km and the rate
export const calcAmount = (basis, quantity, rate, km = 0) => {
  let value = Number(quantity || 0) * Number(rate || 0);
  if (basis === 'fixed') value = Number(rate || 0);
  else if (basis === 'per_ton_km') value *= Number(km || 0);
  return Math.round(value * 100) / 100;
};

// "120 km × ₹50" (or "30 ton × 100 km × ₹4") for a trip's charge
export const describeCharge = (basis, quantity, rate, km = 0) => {
  if (basis === 'fixed') return 'Fixed';
  if (basis === 'per_ton_km') return `${formatNumber(quantity, 3)} ton × ${formatNumber(km, 0)} km × ${formatRupees(rate)}`;
  return `${formatNumber(quantity, 3)} ${getBasisUnit(basis)} × ${formatRupees(rate)}`;
};

export const VEHICLE_CATEGORY_OPTIONS = [
  { value: 'truck', label: 'Truck' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'hyva', label: 'Hyva / Tipper' },
  { value: 'tanker', label: 'Tanker' },
  { value: 'container', label: 'Container' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'jcb', label: 'JCB / Machine' },
  { value: 'other', label: 'Other' },
];

export const getCategoryLabel = (value) => VEHICLE_CATEGORY_OPTIONS.find((option) => option.value === value)?.label || 'Vehicle';

export const PARTY_TYPE_OPTIONS = [
  { value: 'customer', label: 'Customer', hint: 'I carry goods / give vehicle to them' },
  { value: 'transporter', label: 'Vehicle Owner', hint: 'I hire vehicles from them' },
  { value: 'supplier', label: 'Supplier', hint: 'Tyres, diesel, spare parts' },
  { value: 'pump', label: 'Petrol Pump', hint: 'Vehicles fill diesel here' },
  { value: 'other', label: 'Other', hint: '' },
];

export const getPartyTypeLabel = (value) => PARTY_TYPE_OPTIONS.find((option) => option.value === value)?.label || 'Party';

export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'tax', label: 'Road Tax' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'puc', label: 'PUC' },
  { value: 'gps', label: 'GPS' },
  { value: 'permit', label: 'State Permit' },
  { value: 'national_permit', label: 'National Permit' },
  { value: 'rc', label: 'RC' },
  { value: 'other', label: 'Other' },
];

export const getDocTypeLabel = (value) => DOCUMENT_TYPE_OPTIONS.find((option) => option.value === value)?.label || 'Document';

export const INVENTORY_CATEGORY_OPTIONS = [
  { value: 'tyre', label: 'Tyre', unit: 'pcs' },
  { value: 'diesel', label: 'Diesel', unit: 'ltr' },
  { value: 'oil', label: 'Engine Oil / Grease', unit: 'ltr' },
  { value: 'spare', label: 'Spare Part', unit: 'pcs' },
  { value: 'battery', label: 'Battery', unit: 'pcs' },
  { value: 'other', label: 'Other', unit: 'pcs' },
];

export const getInventoryCategoryLabel = (value) => INVENTORY_CATEGORY_OPTIONS.find((option) => option.value === value)?.label || 'Item';

export const PAYMENT_MODE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
];

// Common services with a sensible starting interval
export const MAINTENANCE_PRESETS = [
  { title: 'Engine Oil Change', intervalKm: 10000, intervalDays: 90 },
  { title: 'Full Service', intervalKm: 20000, intervalDays: 180 },
  { title: 'Air Filter', intervalKm: 20000, intervalDays: 0 },
  { title: 'Gear / Diff Oil', intervalKm: 40000, intervalDays: 0 },
  { title: 'Tyre Rotation', intervalKm: 15000, intervalDays: 0 },
  { title: 'Greasing', intervalKm: 3000, intervalDays: 15 },
  { title: 'Brake Check', intervalKm: 25000, intervalDays: 180 },
];

// Badge for an alert status from the server
export const STATUS_BADGES = {
  expired: { label: 'Expired', className: 'badge-red' },
  overdue: { label: 'Overdue', className: 'badge-red' },
  due_soon: { label: 'Due Soon', className: 'badge-orange' },
  ok: { label: 'OK', className: 'badge-green' },
  renewed: { label: 'Renewed', className: 'badge-gray' },
  running: { label: 'Running', className: 'badge-green' },
  upcoming: { label: 'Upcoming', className: 'badge-blue' },
  ended: { label: 'Ended', className: 'badge-gray' },
};
