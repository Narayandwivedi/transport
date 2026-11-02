import { CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { formatDate, formatNumber } from '../utils/format';
import { STATUS_BADGES } from '../utils/constants';
import { RowAction, TD, TH } from './ui';

const kmText = (task) => {
  if (task.kmLeft === null) return null;
  return task.kmLeft <= 0 ? `${formatNumber(-task.kmLeft, 0)} km over` : `${formatNumber(task.kmLeft, 0)} km left`;
};

const dayText = (task) => {
  if (task.daysLeft === null) return null;
  if (task.daysLeft < 0) return `${-task.daysLeft} days late`;
  return task.daysLeft === 0 ? 'Due today' : `${task.daysLeft} days left`;
};

// Service schedules with what is left before each falls due
export default function MaintenanceTable({ tasks, showVehicle = true, onDone, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left">
        <thead>
          <tr>
            {showVehicle && <th className={TH}>Vehicle</th>}
            <th className={TH}>Service</th>
            <th className={TH}>Every</th>
            <th className={TH}>Last Done</th>
            <th className={TH}>Next Due</th>
            <th className={TH}>Status</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task._id} className="tbl-row">
              {showVehicle && (
                <td className={TD}>
                  <p className="font-mono font-semibold">{task.vehicleId?.vehicleNo}</p>
                  <p className="text-xs text-slate-500">Meter {formatNumber(task.currentKm, 0)} km</p>
                </td>
              )}
              <td className={`${TD} font-semibold text-slate-800`}>{task.title}</td>
              <td className={`${TD} text-xs`}>
                {[task.intervalKm ? `${formatNumber(task.intervalKm, 0)} km` : '', task.intervalDays ? `${task.intervalDays} days` : ''].filter(Boolean).join(' / ')}
              </td>
              <td className={`${TD} text-xs`}>
                <p>{formatDate(task.lastDoneDate)}</p>
                {task.lastDoneKm > 0 && <p className="text-slate-500">{formatNumber(task.lastDoneKm, 0)} km</p>}
              </td>
              <td className={`${TD} text-xs`}>
                {task.dueKm !== null && <p>{formatNumber(task.dueKm, 0)} km · <span className={task.kmLeft <= 0 ? 'font-semibold text-rose-700' : 'text-slate-500'}>{kmText(task)}</span></p>}
                {task.dueDate && <p>{formatDate(task.dueDate)} · <span className={task.daysLeft < 0 ? 'font-semibold text-rose-700' : 'text-slate-500'}>{dayText(task)}</span></p>}
              </td>
              <td className={TD}><span className={STATUS_BADGES[task.status]?.className}>{STATUS_BADGES[task.status]?.label}</span></td>
              <td className={TD}>
                <div className="flex justify-end">
                  <RowAction title="Mark done" icon={CheckCircle2} tone="emerald" onClick={() => onDone(task)} />
                  <RowAction title="Edit" icon={Pencil} onClick={() => onEdit(task)} />
                  <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => onDelete(task)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
