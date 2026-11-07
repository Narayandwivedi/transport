import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellOff, Droplet, FileWarning, IdCard, PackageX, Wrench } from 'lucide-react';
import { useAlerts } from '../context/AlertsContext';
import { daysLeftText, formatDate, formatNumber, idOf } from '../utils/format';
import { STATUS_BADGES, getDocTypeLabel } from '../utils/constants';
import { formatMeter } from '../utils/meter';
import StatCard from '../components/StatCard';
import DocumentPopup from '../components/DocumentPopup';
import { DonePopup } from '../components/MaintenancePopups';
import { EmptyState, Loading, Page, PageHeader } from '../components/ui';

const AlertRow = ({ tone, title, detail, badge, action }) => (
  <div className={`flex flex-wrap items-center justify-between gap-3 border-l-4 px-4 py-3 ${tone === 'red' ? 'border-rose-500' : 'border-amber-400'}`}>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="text-xs text-slate-500">{detail}</p>
    </div>
    <div className="flex items-center gap-2">
      {badge}
      {action}
    </div>
  </div>
);

// Everything that needs doing: expired / expiring documents, services due, stock running out
export default function Alerts() {
  const { alerts, reload } = useAlerts();
  const [renewing, setRenewing] = useState(null);
  const [servicing, setServicing] = useState(null);

  if (!alerts) return <Page><Loading /></Page>;
  const { documents, maintenance, lowStock, licenses = [], lowMileage = [] } = alerts;
  const mileageUnit = (row) => (row.unit === 'hrs' ? 'ltr/hr' : 'km/l');

  return (
    <Page>
      <PageHeader title="Alerts" subtitle="Checked automatically every time you open a page" />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-5">
        <StatCard compact icon={FileWarning} tone={documents.length ? 'rose' : 'slate'} label="Documents" value={documents.length} hint="Expired or expiring" />
        <StatCard compact icon={Wrench} tone={maintenance.length ? 'amber' : 'slate'} label="Services Due" value={maintenance.length} hint="By km or by date" />
        <StatCard compact icon={IdCard} tone={licenses.length ? 'rose' : 'slate'} label="Driving Licences" value={licenses.length} hint="Expired or expiring" />
        <StatCard compact icon={PackageX} tone={lowStock.length ? 'amber' : 'slate'} label="Low Stock" value={lowStock.length} />
        <StatCard compact icon={Droplet} tone={lowMileage.length ? 'rose' : 'slate'} label="Low Mileage" value={lowMileage.length} hint="Last 3 months" />
      </section>

      {alerts.count === 0 && (
        <section className="panel"><EmptyState icon={BellOff} title="All clear" hint="No document or licence is expiring, no service is due, stock is fine and mileage is as expected." /></section>
      )}

      {documents.length > 0 && (
        <section className="panel">
          <div className="panel-header flex items-center justify-between py-2.5">
            <h2 className="text-sm font-bold text-slate-800">Documents</h2>
            <Link to="/documents" className="text-xs font-semibold text-primary-600 hover:underline">All documents</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <AlertRow
                key={doc._id}
                tone={doc.status === 'expired' ? 'red' : 'amber'}
                title={`${doc.vehicleId?.vehicleNo} · ${getDocTypeLabel(doc.docType)}`}
                detail={`Expiry ${formatDate(doc.expiryDate)} · ${daysLeftText(doc.daysLeft)}${doc.provider ? ` · ${doc.provider}` : ''}`}
                badge={<span className={STATUS_BADGES[doc.status].className}>{STATUS_BADGES[doc.status].label}</span>}
                action={<button type="button" className="btn-primary btn-sm" onClick={() => setRenewing(doc)}>Renew</button>}
              />
            ))}
          </div>
        </section>
      )}

      {maintenance.length > 0 && (
        <section className="panel">
          <div className="panel-header flex items-center justify-between py-2.5">
            <h2 className="text-sm font-bold text-slate-800">Maintenance</h2>
            <Link to="/maintenance" className="text-xs font-semibold text-primary-600 hover:underline">All schedules</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {maintenance.map((task) => (
              <AlertRow
                key={task._id}
                tone={task.status === 'overdue' ? 'red' : 'amber'}
                title={`${task.vehicleId?.vehicleNo} · ${task.title}`}
                detail={[
                  task.dueKm !== null ? `Due at ${formatMeter(task.dueKm, task.vehicleId)} (meter ${formatMeter(task.currentKm, task.vehicleId)})` : '',
                  task.dueDate ? `Due on ${formatDate(task.dueDate)}` : '',
                ].filter(Boolean).join(' · ')}
                badge={<span className={STATUS_BADGES[task.status].className}>{STATUS_BADGES[task.status].label}</span>}
                action={<button type="button" className="btn-primary btn-sm" onClick={() => setServicing(task)}>Mark Done</button>}
              />
            ))}
          </div>
        </section>
      )}

      {licenses.length > 0 && (
        <section className="panel">
          <div className="panel-header flex items-center justify-between py-2.5">
            <h2 className="text-sm font-bold text-slate-800">Driving Licences</h2>
            <Link to="/payroll" className="text-xs font-semibold text-primary-600 hover:underline">Payroll</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {licenses.map((employee) => (
              <AlertRow
                key={employee._id}
                tone={employee.status === 'expired' ? 'red' : 'amber'}
                title={`${employee.name}${employee.vehicleId?.vehicleNo ? ` · ${employee.vehicleId.vehicleNo}` : ''}`}
                detail={`Licence ${employee.licenseNo || ''} · expiry ${formatDate(employee.licenseExpiry)} · ${daysLeftText(employee.daysLeft)}`}
                badge={<span className={STATUS_BADGES[employee.status].className}>{STATUS_BADGES[employee.status].label}</span>}
              />
            ))}
          </div>
        </section>
      )}

      {lowMileage.length > 0 && (
        <section className="panel">
          <div className="panel-header flex items-center justify-between py-2.5">
            <h2 className="text-sm font-bold text-slate-800">Low Mileage</h2>
            <Link to="/mileage" className="text-xs font-semibold text-primary-600 hover:underline">Mileage</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {lowMileage.map((row) => (
              <AlertRow
                key={String(row.vehicleId)}
                tone="red"
                title={`${row.vehicleNo} · ${formatNumber(row.mileage, 2)} ${mileageUnit(row)}`}
                detail={`Expected ${formatNumber(row.expected, 2)} ${mileageUnit(row)} · ${formatNumber(row.km, 0)} ${row.unit} on ${formatNumber(row.litres, 0)} ltr in the last 3 months. Check for a leak, theft or a wrong reading.`}
                badge={<span className="badge-red">{Math.abs(Math.round(row.vsExpected * 100))}% {row.unit === 'hrs' ? 'over' : 'under'}</span>}
              />
            ))}
          </div>
        </section>
      )}

      {lowStock.length > 0 && (
        <section className="panel">
          <div className="panel-header flex items-center justify-between py-2.5">
            <h2 className="text-sm font-bold text-slate-800">Low Stock</h2>
            <Link to="/inventory" className="text-xs font-semibold text-primary-600 hover:underline">Inventory</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {lowStock.map((item) => (
              <AlertRow
                key={item._id}
                tone="amber"
                title={item.name}
                detail={`In stock ${formatNumber(item.stockQty)} ${item.unit} · alert at ${formatNumber(item.minStock)} ${item.unit}`}
                badge={<span className="badge-orange">Low</span>}
              />
            ))}
          </div>
        </section>
      )}

      {renewing && (
        <DocumentPopup
          preset={{ vehicleId: idOf(renewing.vehicleId), docType: renewing.docType, provider: renewing.provider }}
          onClose={() => setRenewing(null)}
          onSaved={reload}
        />
      )}
      {servicing && <DonePopup task={servicing} onClose={() => setServicing(null)} onSaved={reload} />}
    </Page>
  );
}
