import { useState } from 'react';
import {
  Banknote, CalendarCheck, CalendarDays, HandCoins, IndianRupee, Info, Pencil, Phone, ScrollText, Trash2, UserCheck, UserPlus, Users, UserX, Wallet,
} from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { currentMonthInput, formatDate, formatMonth, formatNumber, formatRupees, monthBounds, todayInput } from '../utils/format';
import { ENTRY_TYPES, SALARY_TYPES, getRoleLabel, rateLabel } from '../utils/payroll';
import StatCard from '../components/StatCard';
import Segmented from '../components/Segmented';
import MonthFilter from '../components/MonthFilter';
import EmployeePopup from '../components/payroll/EmployeePopup';
import EntryPopup from '../components/payroll/EntryPopup';
import { AttendanceDay, AttendanceRegister } from '../components/payroll/Attendance';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, RowAction, TD, TH } from '../components/ui';

const TABS = [
  { key: 'salary', label: 'Salary Sheet', icon: ScrollText },
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'payments', label: 'Payments', icon: Banknote },
];

const Money = ({ value, className = '' }) => (value ? <span className={className}>{formatRupees(value)}</span> : <span className="text-slate-300">—</span>);

export default function Payroll() {
  const [tab, setTab] = useState('salary');
  const [month, setMonth] = useState(currentMonthInput());
  const [attendanceView, setAttendanceView] = useState('day');
  const [attendanceDate, setAttendanceDate] = useState(todayInput());
  const [popup, setPopup] = useState(null);
  const [marks, setMarks] = useState({});

  const range = monthBounds(month);
  const { data: sheet, loading, error, reload: reloadSheet } = useFetch('/payroll/sheet', { month });
  const { data: employees, reload: reloadEmployees } = useFetch('/payroll/employees', {}, []);
  const { data: entries, reload: reloadEntries } = useFetch('/payroll/entries', { month }, []);
  // Attendance for the month shown, or the day picked in another month
  const markRange = attendanceView === 'day' && !attendanceDate.startsWith(month) ? { from: attendanceDate, to: attendanceDate } : range;
  const { data: markList, reload: reloadMarks } = useFetch('/payroll/attendance', markRange, []);

  const allEmployees = employees || [];
  const working = allEmployees.filter((employee) => employee.isActive);
  const rows = sheet?.rows || [];
  const totals = sheet?.totals || {};
  const balances = Object.fromEntries(rows.map((row) => [row.employee._id, row.closing]));
  // Saved marks with any change made on this page on top, so a click shows at once
  const markMap = { ...Object.fromEntries((markList || []).map((mark) => [`${mark.employeeId}:${mark.date}`, mark.status])), ...marks };

  const reloadAll = () => {
    reloadSheet();
    reloadEmployees();
    reloadEntries();
  };

  const saveMarks = async (list) => {
    setMarks((prev) => ({ ...prev, ...Object.fromEntries(list.map((mark) => [`${mark.employeeId}:${mark.date}`, mark.status])) }));
    try {
      await apiClient.post('/payroll/attendance', { marks: list });
      reloadSheet();
    } catch (err) {
      toast.error(err.message);
      setMarks({});
      reloadMarks();
    }
  };

  const markAllPresent = () => saveMarks(working
    .filter((employee) => !markMap[`${employee._id}:${attendanceDate}`])
    .map((employee) => ({ employeeId: employee._id, date: attendanceDate, status: 'present' })));

  const toggleActive = async (employee) => {
    let leftDate = null;
    if (employee.isActive) {
      leftDate = window.prompt(`Last working day of ${employee.name} (YYYY-MM-DD). Salary is counted up to this day.`, todayInput());
      if (!leftDate) return;
    }
    try {
      await apiClient.put(`/payroll/employees/${employee._id}`, { isActive: !employee.isActive, leftDate });
      toast.success(employee.isActive ? 'Marked as left' : 'Marked as working');
      reloadAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteEmployee = async (employee) => {
    if (!window.confirm(`Delete ${employee.name}?`)) return;
    try {
      await apiClient.delete(`/payroll/employees/${employee._id}`);
      toast.success('Employee deleted');
      reloadAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteEntry = async (entry) => {
    if (!window.confirm('Delete this entry? Its expense is removed too.')) return;
    try {
      await apiClient.delete(`/payroll/entries/${entry._id}`);
      toast.success('Entry deleted');
      reloadAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openEntry = (type, employeeId = '') => setPopup({ kind: 'entry', preset: { type, employeeId } });

  return (
    <Page>
      <PageHeader title="Payroll" subtitle={`Drivers and staff: attendance, advances, bata and salary · ${formatMonth(month)}`}>
        <MonthFilter value={month} onChange={(value) => { setMonth(value); setMarks({}); }} />
        <button type="button" className="btn-secondary" onClick={() => openEntry('advance')} disabled={!working.length}><HandCoins size={16} /> Advance</button>
        <button type="button" className="btn-primary" onClick={() => setPopup({ kind: 'employee' })}><UserPlus size={18} /> Add Employee</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Users} tone="blue" label="Working" value={working.length} hint={`${working.filter((employee) => employee.role === 'driver').length} drivers · ${allEmployees.length - working.length} left`} />
        <StatCard compact icon={IndianRupee} tone="emerald" label="Salary Earned" value={formatRupees(totals.earned + totals.bonus - totals.deduction)} hint={`By attendance · ${formatMonth(month)}`} />
        <StatCard compact icon={HandCoins} tone="amber" label="Paid This Month" value={formatRupees(totals.advance + totals.paid + totals.bata)} hint={`${formatRupees(totals.advance)} adv · ${formatRupees(totals.bata)} bata`} />
        <StatCard compact icon={Wallet} tone="rose" label="Balance to Pay" value={formatRupees(totals.closing)} hint="Including earlier months" />
      </section>

      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === 'salary' && (
        <section className="panel">
          <PanelHeader title={`Salary Sheet · ${formatMonth(month)}`} count={rows.length} onRefresh={reloadAll} loading={loading} />
          {loading && !sheet ? <Loading /> : rows.length === 0 ? <EmptyState title="No employees yet" hint='Use "Add Employee" to start.' /> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left">
                  <thead>
                    <tr>
                      <th className={TH}>Employee</th>
                      <th className={TH}>Salary</th>
                      <th className={`${TH} text-right`}>Days</th>
                      <th className={`${TH} text-right`}>Previous</th>
                      <th className={`${TH} text-right`}>Earned</th>
                      <th className={`${TH} text-right`}>Bonus / Ded.</th>
                      <th className={`${TH} text-right`}>Advance</th>
                      <th className={`${TH} text-right`}>Paid</th>
                      <th className={`${TH} text-right`}>Balance</th>
                      <th className={TH} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.employee._id} className={`tbl-row ${row.employee.isActive ? '' : 'opacity-60'}`}>
                        <td className={TD}>
                          <p className="font-semibold text-slate-800">{row.employee.name}</p>
                          <p className="text-xs text-slate-500">{getRoleLabel(row.employee.role)}{row.employee.vehicleId?.vehicleNo ? ` · ${row.employee.vehicleId.vehicleNo}` : ''}</p>
                        </td>
                        <td className={TD}>
                          <p className="whitespace-nowrap font-medium text-slate-800">{rateLabel(row.employee)}</p>
                          <span className={row.employee.salaryType === 'monthly' ? 'badge-blue' : 'badge-orange'}>{SALARY_TYPES[row.employee.salaryType].label}</span>
                        </td>
                        <td className={`${TD} text-right`}>
                          <p className="font-semibold text-slate-800">{formatNumber(row.daysWorked, 1)}</p>
                          <p className="whitespace-nowrap text-xs text-slate-500">{row.present}P · {row.half}H · {row.absent}A</p>
                        </td>
                        <td className={`${TD} text-right`}><Money value={row.opening} className={row.opening < 0 ? 'text-amber-700' : 'text-slate-600'} /></td>
                        <td className={`${TD} whitespace-nowrap text-right font-semibold text-slate-800`}>{formatRupees(row.earned)}</td>
                        <td className={`${TD} whitespace-nowrap text-right text-xs`}>
                          {row.bonus > 0 && <p className="text-emerald-700">+ {formatRupees(row.bonus)}</p>}
                          {row.deduction > 0 && <p className="text-rose-700">− {formatRupees(row.deduction)}</p>}
                          {!row.bonus && !row.deduction && <span className="text-slate-300">—</span>}
                        </td>
                        <td className={`${TD} text-right`}><Money value={row.advance} className="text-amber-700" /></td>
                        <td className={`${TD} text-right`}><Money value={row.paid} className="text-emerald-700" /></td>
                        <td className={`${TD} whitespace-nowrap text-right font-bold ${row.closing < 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                          {row.closing < 0 ? `${formatRupees(-row.closing)} adv` : formatRupees(row.closing)}
                        </td>
                        <td className={TD}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" className="btn-secondary btn-sm" onClick={() => openEntry('advance', row.employee._id)}><HandCoins size={14} /> Advance</button>
                            <button type="button" className="btn-primary btn-sm" onClick={() => openEntry('salary', row.employee._id)} disabled={row.closing <= 0}><Banknote size={14} /> Pay</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 font-bold">
                      <td className={TD} colSpan={3}>Total · {formatMonth(month)}</td>
                      <td className={`${TD} text-right`}>{formatRupees(totals.opening)}</td>
                      <td className={`${TD} text-right`}>{formatRupees(totals.earned)}</td>
                      <td className={`${TD} text-right`}>{formatRupees(totals.bonus - totals.deduction)}</td>
                      <td className={`${TD} text-right text-amber-700`}>{formatRupees(totals.advance)}</td>
                      <td className={`${TD} text-right text-emerald-700`}>{formatRupees(totals.paid)}</td>
                      <td className={`${TD} text-right`}>{formatRupees(totals.closing)}</td>
                      <td className={TD} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="flex items-start gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 md:px-5">
                <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
                <span>
                  Monthly salary is counted for the days on the job up to today, less absent days (half days count half).
                  Daily wage = wage × days present. Balance = previous + earned + bonus − deduction − advance − paid, and carries to next month.
                  Bata is paid outside salary. Salary, advance and bata are added to the vehicle&apos;s expenses automatically.
                </span>
              </p>
            </>
          )}
        </section>
      )}

      {tab === 'employees' && (
        <section className="panel">
          <PanelHeader title="Employees" count={allEmployees.length} onRefresh={reloadAll} />
          {allEmployees.length === 0 ? <EmptyState title="No employees yet" hint='Use "Add Employee" to add the first driver.' /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr>
                    <th className={TH}>Employee</th>
                    <th className={TH}>Mobile</th>
                    <th className={TH}>Vehicle</th>
                    <th className={`${TH} text-right`}>Salary</th>
                    <th className={TH}>Licence</th>
                    <th className={TH}>Joined</th>
                    <th className={TH}>Status</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {allEmployees.map((employee) => {
                    const licenceDays = employee.licenseExpiry ? Math.round((new Date(employee.licenseExpiry) - new Date(todayInput())) / 86400000) : null;
                    return (
                      <tr key={employee._id} className={`tbl-row ${employee.isActive ? '' : 'opacity-60'}`}>
                        <td className={TD}>
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700 ring-1 ring-inset ring-primary-100">
                              {employee.name[0]?.toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800">{employee.name}</p>
                              <p className="text-xs text-slate-500">{getRoleLabel(employee.role)}</p>
                            </div>
                          </div>
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>
                          {employee.mobile ? <span className="inline-flex items-center gap-1.5"><Phone size={13} className="text-slate-400" />{employee.mobile}</span> : '—'}
                        </td>
                        <td className={`${TD} font-mono`}>{employee.vehicleId?.vehicleNo || <span className="font-sans text-slate-400">—</span>}</td>
                        <td className={`${TD} whitespace-nowrap text-right font-semibold text-slate-800`}>{rateLabel(employee)}</td>
                        <td className={`${TD} text-xs`}>
                          {employee.licenseNo && <p className="font-mono">{employee.licenseNo}</p>}
                          {employee.licenseExpiry ? (
                            <p className={licenceDays < 0 ? 'font-semibold text-rose-700' : licenceDays <= 30 ? 'font-semibold text-amber-700' : 'text-slate-500'}>
                              {licenceDays < 0 ? 'Expired' : 'Valid till'} {formatDate(employee.licenseExpiry)}
                            </p>
                          ) : !employee.licenseNo && <span className="text-slate-400">—</span>}
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>{formatDate(employee.joinDate)}</td>
                        <td className={TD}>
                          <span className={employee.isActive ? 'badge-green' : 'badge-gray'}>{employee.isActive ? 'Working' : `Left ${formatDate(employee.leftDate)}`}</span>
                        </td>
                        <td className={TD}>
                          <div className="flex justify-end">
                            <RowAction title="Edit" icon={Pencil} onClick={() => setPopup({ kind: 'employee', employee })} />
                            <RowAction title={employee.isActive ? 'Mark as left' : 'Mark as working'} icon={employee.isActive ? UserX : UserCheck} tone="amber" onClick={() => toggleActive(employee)} />
                            <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => deleteEmployee(employee)} />
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
      )}

      {tab === 'attendance' && (
        <section className="panel">
          <PanelHeader title="Attendance">
            <Segmented
              value={attendanceView}
              onChange={setAttendanceView}
              options={[{ key: 'day', label: 'By Day', icon: CalendarCheck }, { key: 'month', label: 'Month Register', icon: CalendarDays }]}
            />
          </PanelHeader>
          {attendanceView === 'day' ? (
            <AttendanceDay
              employees={working}
              date={attendanceDate}
              marks={markMap}
              onDateChange={setAttendanceDate}
              onMark={(employeeId, date, status) => saveMarks([{ employeeId, date, status }])}
              onMarkAll={markAllPresent}
            />
          ) : (
            <AttendanceRegister
              employees={working}
              month={month}
              marks={markMap}
              onMark={(employeeId, date, status) => saveMarks([{ employeeId, date, status }])}
            />
          )}
        </section>
      )}

      {tab === 'payments' && (
        <section className="panel">
          <PanelHeader title={`Payments · ${formatMonth(month)}`} count={(entries || []).length} onRefresh={reloadAll}>
            <button type="button" className="btn-secondary btn-sm" onClick={() => openEntry('bata')} disabled={!working.length}>Bata</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => openEntry('deduction')} disabled={!working.length}>Deduction</button>
            <button type="button" className="btn-primary btn-sm" onClick={() => openEntry('salary')} disabled={!working.length}><Banknote size={14} /> Pay Salary</button>
          </PanelHeader>
          {(entries || []).length === 0 ? <EmptyState title="Nothing recorded this month" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr>
                    <th className={TH}>Date</th>
                    <th className={TH}>Employee</th>
                    <th className={TH}>Type</th>
                    <th className={TH}>Vehicle</th>
                    <th className={TH}>Notes</th>
                    <th className={`${TH} text-right`}>Amount</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry._id} className="tbl-row">
                      <td className={`${TD} whitespace-nowrap`}>{formatDate(entry.date)}</td>
                      <td className={`${TD} font-semibold text-slate-800`}>{entry.employeeId?.name}</td>
                      <td className={TD}><span className={ENTRY_TYPES[entry.type].className}>{ENTRY_TYPES[entry.type].short}</span></td>
                      <td className={`${TD} font-mono`}>{ENTRY_TYPES[entry.type].paid ? entry.vehicleId?.vehicleNo || <span className="font-sans text-slate-400">General</span> : '—'}</td>
                      <td className={TD}>{[ENTRY_TYPES[entry.type].paid && entry.mode.toUpperCase(), entry.notes].filter(Boolean).join(' · ') || '—'}</td>
                      <td className={`${TD} text-right font-semibold ${entry.type === 'deduction' ? 'text-rose-700' : 'text-slate-800'}`}>{entry.type === 'deduction' ? '− ' : ''}{formatRupees(entry.amount)}</td>
                      <td className={TD}>
                        <div className="flex justify-end">
                          <RowAction title="Edit" icon={Pencil} onClick={() => setPopup({ kind: 'entry', entry })} />
                          <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => deleteEntry(entry)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {popup?.kind === 'employee' && <EmployeePopup employee={popup.employee} onClose={() => setPopup(null)} onSaved={reloadAll} />}
      {popup?.kind === 'entry' && (
        <EntryPopup
          entry={popup.entry}
          preset={popup.preset}
          employees={allEmployees}
          month={month}
          balances={balances}
          onClose={() => setPopup(null)}
          onSaved={reloadAll}
        />
      )}
    </Page>
  );
}
