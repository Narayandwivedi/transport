import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Eye, Gauge, Handshake, Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { currentMonthInput, formatRupees, idOf } from '../utils/format';
import { getBasisLabel, getCategoryLabel } from '../utils/constants';
import { formatMeter } from '../utils/meter';
import StatCard from '../components/StatCard';
import Segmented from '../components/Segmented';
import VehiclePopup from '../components/VehiclePopup';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, RowAction, TD, TH } from '../components/ui';

export default function Vehicles() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [ownership, setOwnership] = useState('');
  const [editing, setEditing] = useState(null);
  const { data: vehicles, loading, error, reload } = useFetch('/vehicles', { search, ownership }, []);
  const { data: contracts } = useFetch('/contracts', {}, []);
  const { data: profit } = useFetch('/reports/profit', { month: currentMonthInput() });
  // Drivers come from the Drivers page, where each is given a vehicle
  const { data: drivers } = useFetch('/payroll/employees', { role: 'driver' }, []);
  const driverOf = (vehicleId) => (drivers || []).find((driver) => driver.isActive && idOf(driver.vehicleId) === vehicleId);

  const list = vehicles || [];
  const running = (contracts || []).filter((contract) => contract.status === 'running');
  const contractsOf = (vehicleId, direction) => running.filter((contract) => idOf(contract.vehicleId) === vehicleId && contract.direction === direction);
  const profitOf = useMemo(() => new Map((profit?.vehicles || []).map((row) => [row.vehicleId, row])), [profit]);

  const handleDelete = async (vehicle) => {
    if (!window.confirm(`Delete ${vehicle.vehicleNo}? Its meter readings, services and documents are deleted too.`)) return;
    try {
      await apiClient.delete(`/vehicles/${vehicle._id}`);
      toast.success('Vehicle deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const hireNote = (vehicle) => {
    const hiredIn = contractsOf(vehicle._id, 'hire_in')[0];
    const givenOut = contractsOf(vehicle._id, 'give_out')[0];
    const notes = [];
    if (vehicle.ownership === 'hired') {
      if (hiredIn) notes.push(`Hired monthly ${formatRupees(hiredIn.monthlyRate)}`);
      else if (vehicle.hireBasis) notes.push(`Hired ${getBasisLabel(vehicle.hireBasis)} @ ${formatRupees(vehicle.hireRate)}`);
      else notes.push('Hired · no rate set');
    }
    if (vehicle.routeRates?.length) notes.push(`${vehicle.routeRates.length} route rate${vehicle.routeRates.length === 1 ? '' : 's'}`);
    if (givenOut) notes.push(`Given to ${givenOut.partyId?.name} @ ${formatRupees(givenOut.monthlyRate)}/month`);
    return notes;
  };

  const ownedCount = list.filter((vehicle) => vehicle.ownership === 'own').length;

  return (
    <Page>
      <PageHeader title="Vehicles" subtitle="Your own fleet and the vehicles you hire">
        <button type="button" className="btn-primary" onClick={() => setEditing({})}><Plus size={18} /> Add Vehicle</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Truck} tone="indigo" label="Total Vehicles" value={list.length} hint={`${ownedCount} mine · ${list.length - ownedCount} hired`} />
        <StatCard compact icon={CalendarClock} tone="amber" label="Hired In Monthly" value={running.filter((contract) => contract.direction === 'hire_in').length} />
        <StatCard compact icon={Handshake} tone="emerald" label="Given Out Monthly" value={running.filter((contract) => contract.direction === 'give_out').length} />
        <StatCard compact icon={Gauge} tone="blue" label="Profit This Month" value={formatRupees(profit?.totals?.profit)} hint="All vehicles, after expenses" />
      </section>

      <section className="panel">
        <PanelHeader title="All Vehicles" count={list.length} search={search} onSearch={setSearch} searchPlaceholder="Search number or driver" onRefresh={reload} loading={loading}>
          <Segmented value={ownership} onChange={setOwnership} options={[{ key: '', label: 'All' }, { key: 'own', label: 'Mine' }, { key: 'hired', label: 'Hired' }]} />
        </PanelHeader>
        {loading && !list.length ? <Loading /> : list.length === 0 ? (
          <EmptyState title="No vehicles found" hint={search ? 'Try a different search.' : 'Add the first vehicle with "Add Vehicle".'} />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {list.map((vehicle) => (
                <li key={vehicle._id} className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 active:bg-slate-50" onClick={() => navigate(`/vehicles/${vehicle._id}`)}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-mono text-sm font-semibold text-slate-800">{vehicle.vehicleNo}</p>
                      <span className={vehicle.ownership === 'own' ? 'badge-blue' : 'badge-orange'}>{vehicle.ownership === 'own' ? 'Mine' : 'Hired'}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{getCategoryLabel(vehicle.category)} · {formatMeter(vehicle.currentKm, vehicle)}</p>
                    {hireNote(vehicle).map((note) => <p key={note} className="truncate text-[11px] font-medium text-amber-700">{note}</p>)}
                  </div>
                  <span className={`shrink-0 text-sm font-bold ${(profitOf.get(vehicle._id)?.profit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatRupees(profitOf.get(vehicle._id)?.profit)}</span>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-left">
                <thead>
                  <tr>
                    <th className={TH}>Vehicle No.</th>
                    <th className={TH}>Owner / Hire</th>
                    <th className={TH}>Driver</th>
                    <th className={`${TH} text-right`}>Odometer</th>
                    <th className={`${TH} text-right`}>Profit (month)</th>
                    <th className={TH}>Status</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {list.map((vehicle) => {
                    const row = profitOf.get(vehicle._id);
                    return (
                      <tr key={vehicle._id} className="tbl-row cursor-pointer" onClick={() => navigate(`/vehicles/${vehicle._id}`)}>
                        <td className={TD}>
                          <p className="whitespace-nowrap font-mono font-semibold text-slate-800">{vehicle.vehicleNo}</p>
                          <p className="text-xs text-slate-500">{getCategoryLabel(vehicle.category)}{vehicle.capacityTons ? ` · ${vehicle.capacityTons} ton` : ''}</p>
                        </td>
                        <td className={TD}>
                          <p className="font-medium text-slate-700">{vehicle.ownership === 'own' ? 'My Vehicle' : vehicle.ownerPartyId?.name || 'Hired'}</p>
                          {hireNote(vehicle).map((note) => <p key={note} className="text-xs font-medium text-amber-700">{note}</p>)}
                        </td>
                        <td className={TD}>
                          <p>{driverOf(vehicle._id)?.name || '—'}</p>
                          {driverOf(vehicle._id)?.mobile && <p className="text-xs text-slate-500">{driverOf(vehicle._id).mobile}</p>}
                        </td>
                        <td className={`${TD} whitespace-nowrap text-right`}>{formatMeter(vehicle.currentKm, vehicle)}</td>
                        <td className={`${TD} text-right font-semibold ${(row?.profit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatRupees(row?.profit)}</td>
                        <td className={TD}>
                          <span className={vehicle.status === 'active' ? 'badge-green' : vehicle.status === 'sold' ? 'badge-gray' : 'badge-orange'}>
                            {vehicle.status === 'sold' ? 'Sold' : vehicle.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className={TD}>
                          <div className="flex justify-end">
                            <RowAction title="Open" icon={Eye} tone="emerald" onClick={() => navigate(`/vehicles/${vehicle._id}`)} />
                            <RowAction title="Edit" icon={Pencil} onClick={() => setEditing(vehicle)} />
                            <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => handleDelete(vehicle)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {editing && <VehiclePopup vehicle={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={reload} />}
    </Page>
  );
}
