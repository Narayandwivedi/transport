import { CheckCheck } from 'lucide-react';
import { formatDate, todayInput } from '../../utils/format';
import { ATTENDANCE, getRoleLabel } from '../../utils/payroll';
import { EmptyState } from '../ui';

const STATUS_OF = Object.fromEntries(ATTENDANCE.map((status) => [status.key, status]));
// Clicking a register cell steps through: blank → P → H → A → blank
const NEXT = { '': 'present', present: 'half', half: 'absent', absent: '' };

/** Mark each working employee present / half day / absent for one date. */
export function AttendanceDay({ employees, date, marks, onDateChange, onMark, onMarkAll }) {
  const statusOf = (employeeId) => marks[`${employeeId}:${date}`] || '';
  const notMarked = employees.filter((employee) => !statusOf(employee._id)).length;

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex items-center gap-3">
          <input type="date" className="input w-auto" value={date} max={todayInput()} onChange={(event) => event.target.value && onDateChange(event.target.value)} />
          <p className="text-sm font-semibold text-slate-700">{formatDate(date)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-xs font-medium">
            {ATTENDANCE.map((status) => (
              <span key={status.key} className={`mr-3 font-semibold ${status.text}`}>
                {employees.filter((employee) => statusOf(employee._id) === status.key).length} {status.label}
              </span>
            ))}
            {notMarked > 0 && <span className="font-semibold text-slate-400">{notMarked} Not marked</span>}
          </p>
          <button type="button" className="btn-secondary btn-sm" onClick={onMarkAll} disabled={!notMarked}>
            <CheckCheck size={14} /> Mark rest present
          </button>
        </div>
      </div>

      {employees.length === 0 ? <EmptyState title="No working employees" hint="Add an employee to mark attendance." /> : (
        <ul className="divide-y divide-slate-100">
          {employees.map((employee) => (
            <li key={employee._id} className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-slate-50 md:px-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{employee.name}</p>
                <p className="truncate text-xs text-slate-500">{getRoleLabel(employee.role)}{employee.vehicleId?.vehicleNo ? ` · ${employee.vehicleId.vehicleNo}` : ''}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {ATTENDANCE.map((status) => {
                  const selected = statusOf(employee._id) === status.key;
                  return (
                    <button
                      key={status.key}
                      type="button"
                      onClick={() => onMark(employee._id, date, selected ? '' : status.key)}
                      aria-pressed={selected}
                      title={status.label}
                      className={`h-9 rounded-lg px-3 text-sm font-bold ring-1 ring-inset transition ${selected ? status.active : 'bg-white text-slate-500 ring-slate-300 hover:bg-slate-100'}`}
                    >
                      <span className="sm:hidden">{status.short}</span>
                      <span className="hidden sm:inline">{status.label}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The whole month at a glance: one row per employee, one cell per day. Click a cell to change it. */
export function AttendanceRegister({ employees, month, marks, onMark }) {
  const [year, mon] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const today = todayInput();
  const dayList = Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
  const weekday = (day) => new Date(`${day}T00:00:00Z`).getUTCDay();

  if (employees.length === 0) return <EmptyState title="No working employees" />;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="tbl-head sticky left-0 z-10 min-w-[150px] bg-slate-50">Employee</th>
              {dayList.map((day) => (
                <th key={day} className={`bg-slate-50 px-0.5 py-2 text-center text-[10px] font-semibold ${weekday(day) === 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                  {Number(day.slice(8))}
                </th>
              ))}
              <th className="tbl-head text-center">P</th>
              <th className="tbl-head text-center">H</th>
              <th className="tbl-head text-center">A</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const count = (key) => dayList.filter((day) => marks[`${employee._id}:${day}`] === key).length;
              return (
                <tr key={employee._id} className="tbl-row">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 md:px-5">{employee.name}</td>
                  {dayList.map((day) => {
                    const status = marks[`${employee._id}:${day}`] || '';
                    const future = day > today;
                    return (
                      <td key={day} className="px-0.5 py-1 text-center">
                        <button
                          type="button"
                          disabled={future}
                          onClick={() => onMark(employee._id, day, NEXT[status])}
                          title={`${formatDate(day)}${status ? ` · ${STATUS_OF[status].label}` : ''}`}
                          className={`h-6 w-6 rounded text-[10px] font-bold transition disabled:opacity-30 ${status ? STATUS_OF[status].cell : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                        >
                          {status ? STATUS_OF[status].short : ''}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 text-center text-sm font-semibold text-emerald-700">{count('present')}</td>
                  <td className="px-2 text-center text-sm font-semibold text-amber-700">{count('half')}</td>
                  <td className="px-2 text-center text-sm font-semibold text-rose-700">{count('absent')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 md:px-5">
        Click a day to step through Present → Half → Absent → blank. Monthly salary staff only need their absent and half days marked; daily wage staff need every day they worked.
      </p>
    </>
  );
}
