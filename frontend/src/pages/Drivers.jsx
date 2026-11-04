import { useMemo, useState } from 'react';
import { BadgeAlert, Pencil, Phone, Plus, Route, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { formatDate, todayInput } from '../utils/format';
import { rateLabel } from '../utils/payroll';
import StatCard from '../components/StatCard';
import Segmented from '../components/Segmented';
import EmployeePopup from '../components/payroll/EmployeePopup';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, RowAction, TD, TH } from '../components/ui';

// Days until a date, from today (negative once it has passed)
const daysUntil = (date) => (date ? Math.round((new Date(date) - new Date(todayInput())) / 86400000) : null);

/** Drivers: employees whose work is "driver". The same records show in Payroll for salary and attendance. */
export default function Drivers() {
  const [search, setSearch] = useState('');
  const [show, setShow] = useState('working');
  const [editing, setEditing] = useState(null);
  const { data: drivers, loading, error, reload } = useFetch('/payroll/employees', { role: 'driver', search }, []);
  const { data: tripStats, reload: reloadStats } = useFetch('/payroll/driver-trips', {}, []);

  const statsOf = useMemo(() => new Map((tripStats || []).map((row) => [row.driverId, row])), [tripStats]);
  const all = drivers || [];
  const working = all.filter((driver) => driver.isActive);
  const shown = show === 'working' ? working : show === 'left' ? all.filter((driver) => !driver.isActive) : all;
  const licenceDue = working.filter((driver) => {
    const days = daysUntil(driver.licenseExpiry);
    return days !== null && days <= 30;
  }).length;
  const withoutVehicle = working.filter((driver) => !driver.vehicleId).length;

  const refresh = () => {
    reload();
    reloadStats();
  };

  const toggleActive = async (driver) => {
    let leftDate = null;
    if (driver.isActive) {
      leftDate = window.prompt(`Last working day of ${driver.name} (YYYY-MM-DD). Salary is counted up to this day.`, todayInput());
      if (!leftDate) return;
    }
    try {
      await apiClient.put(`/payroll/employees/${driver._id}`, { isActive: !driver.isActive, leftDate });
      toast.success(driver.isActive ? 'Marked as left' : 'Marked as working');
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (driver) => {
    if (!window.confirm(`Delete ${driver.name}?`)) return;
    try {
      await apiClient.delete(`/payroll/employees/${driver._id}`);
      toast.success('Driver deleted');
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Page>
      <PageHeader title="Drivers" subtitle="Driver details, licence, vehicle and trips. Salary and attendance are in Payroll.">
        <button type="button" className="btn-primary" onClick={() => setEditing({})}><Plus size={18} /> Add Driver</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Users} tone="indigo" label="Working Drivers" value={working.length} hint={`${all.length - working.length} left`} />
        <StatCard compact icon={Route} tone="emerald" label="Trips Driven" value={(tripStats || []).reduce((total, row) => total + row.trips, 0)} />
        <StatCard compact icon={BadgeAlert} tone="rose" label="Licence Due" value={licenceDue} hint="Expired or within 30 days" />
        <StatCard compact icon={UserX} tone="amber" label="No Vehicle" value={withoutVehicle} hint="Working, not on a vehicle" />
      </section>

      <section className="panel">
        <PanelHeader title="All Drivers" count={shown.length} search={search} onSearch={setSearch} searchPlaceholder="Search name, mobile or licence" onRefresh={refresh} loading={loading}>
          <Segmented value={show} onChange={setShow} options={[{ key: 'working', label: 'Working' }, { key: 'left', label: 'Left' }, { key: 'all', label: 'All' }]} />
        </PanelHeader>
        {loading && !all.length ? <Loading /> : shown.length === 0 ? (
          <EmptyState title="No drivers found" hint='Add a driver with "Add Driver".' />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Driver</th>
                  <th className={TH}>Mobile</th>
                  <th className={TH}>Vehicle</th>
                  <th className={TH}>Licence</th>
                  <th className={`${TH} text-right`}>Salary</th>
                  <th className={`${TH} text-right`}>Trips</th>
                  <th className={TH}>Joined</th>
                  <th className={TH}>Status</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {shown.map((driver) => {
                  const licenceDays = daysUntil(driver.licenseExpiry);
                  const stats = statsOf.get(driver._id);
                  return (
                    <tr key={driver._id} className={`tbl-row cursor-pointer ${driver.isActive ? '' : 'opacity-60'}`} onClick={() => setEditing(driver)}>
                      <td className={TD}>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700 ring-1 ring-inset ring-primary-100">
                            {driver.name[0]?.toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800">{driver.name}</p>
                            {driver.address && <p className="truncate text-xs text-slate-500">{driver.address}</p>}
                          </div>
                        </div>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>
                        {driver.mobile ? (
                          <a href={`tel:${driver.mobile}`} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1.5 hover:text-primary-700">
                            <Phone size={13} className="text-slate-400" />{driver.mobile}
                          </a>
                        ) : '—'}
                      </td>
                      <td className={`${TD} font-mono`}>{driver.vehicleId?.vehicleNo || <span className="font-sans text-slate-400">—</span>}</td>
                      <td className={`${TD} text-xs`}>
                        {driver.licenseNo && <p className="font-mono">{driver.licenseNo}</p>}
                        {driver.licenseExpiry ? (
                          <p className={licenceDays < 0 ? 'font-semibold text-rose-700' : licenceDays <= 30 ? 'font-semibold text-amber-700' : 'text-slate-500'}>
                            {licenceDays < 0 ? 'Expired' : 'Valid till'} {formatDate(driver.licenseExpiry)}
                          </p>
                        ) : !driver.licenseNo && <span className="text-slate-400">—</span>}
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right font-semibold text-slate-800`}>{rateLabel(driver)}</td>
                      <td className={`${TD} whitespace-nowrap text-right`}>
                        <p className="font-semibold text-slate-800">{stats?.trips || 0}</p>
                        {stats?.lastTrip && <p className="text-xs text-slate-500">Last {formatDate(stats.lastTrip)}</p>}
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>{formatDate(driver.joinDate)}</td>
                      <td className={TD}>
                        <span className={driver.isActive ? 'badge-green' : 'badge-gray'}>{driver.isActive ? 'Working' : `Left ${formatDate(driver.leftDate)}`}</span>
                      </td>
                      <td className={TD} onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end">
                          <RowAction title="Edit" icon={Pencil} onClick={() => setEditing(driver)} />
                          <RowAction title={driver.isActive ? 'Mark as left' : 'Mark as working'} icon={driver.isActive ? UserX : UserCheck} tone="amber" onClick={() => toggleActive(driver)} />
                          <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => handleDelete(driver)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <EmployeePopup employee={editing._id ? editing : null} defaultRole="driver" onClose={() => setEditing(null)} onSaved={refresh} />}
    </Page>
  );
}
