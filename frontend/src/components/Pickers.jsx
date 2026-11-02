import { getCategoryLabel, getPartyTypeLabel } from '../utils/constants';

// Vehicle dropdown: "CG04AB1234 · Truck · Hired"
export function VehicleSelect({ vehicles, value, onChange, allowEmpty = false, emptyLabel = 'Select vehicle', id, required = false, includeSold = false }) {
  const list = vehicles.filter((vehicle) => includeSold || vehicle.status !== 'sold' || vehicle._id === value);
  return (
    <select id={id} className="input" value={value || ''} onChange={(event) => onChange(event.target.value)} required={required}>
      <option value="" disabled={!allowEmpty}>{emptyLabel}</option>
      {list.map((vehicle) => (
        <option key={vehicle._id} value={vehicle._id}>
          {vehicle.vehicleNo} · {getCategoryLabel(vehicle.category)}{vehicle.ownership === 'hired' ? ' · Hired' : ''}
        </option>
      ))}
    </select>
  );
}

// Party dropdown; the preferred types are listed first
export function PartySelect({ parties, value, onChange, prefer = [], allowEmpty = false, emptyLabel = 'Select party', id, required = false }) {
  const rank = (party) => (prefer.includes(party.type) ? 0 : 1);
  const sorted = [...parties].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return (
    <select id={id} className="input" value={value || ''} onChange={(event) => onChange(event.target.value)} required={required}>
      <option value="" disabled={!allowEmpty}>{emptyLabel}</option>
      {sorted.map((party) => (
        <option key={party._id} value={party._id}>{party.name} · {getPartyTypeLabel(party.type)}</option>
      ))}
    </select>
  );
}
