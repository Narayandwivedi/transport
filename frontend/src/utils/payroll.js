import { formatRupees } from './format';

export const ROLE_OPTIONS = [
  { value: 'driver', label: 'Driver' },
  { value: 'helper', label: 'Helper / Cleaner' },
  { value: 'mechanic', label: 'Mechanic' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'office', label: 'Office Staff' },
  { value: 'other', label: 'Other' },
];

export const getRoleLabel = (role) => ROLE_OPTIONS.find((option) => option.value === role)?.label || 'Staff';

export const SALARY_TYPES = {
  monthly: { label: 'Monthly Salary', unit: 'month', hint: 'Fixed salary, less absent days' },
  daily: { label: 'Daily Wage', unit: 'day', hint: 'Wage × days present' },
};

export const rateLabel = (employee) => `${formatRupees(employee.rate)} / ${SALARY_TYPES[employee.salaryType]?.unit || 'month'}`;

// days = how much of a day's pay each status earns
export const ATTENDANCE = [
  { key: 'present', label: 'Present', short: 'P', active: 'bg-emerald-600 text-white ring-emerald-600', cell: 'bg-emerald-500 text-white', text: 'text-emerald-700' },
  { key: 'half', label: 'Half Day', short: 'H', active: 'bg-amber-500 text-white ring-amber-500', cell: 'bg-amber-400 text-white', text: 'text-amber-700' },
  { key: 'absent', label: 'Absent', short: 'A', active: 'bg-rose-600 text-white ring-rose-600', cell: 'bg-rose-500 text-white', text: 'text-rose-700' },
];

// What can be recorded for an employee, and how it moves their balance
export const ENTRY_TYPES = {
  salary: { label: 'Salary Paid', short: 'Salary', className: 'badge-green', hint: 'Paid out of salary owed', paid: true },
  advance: { label: 'Advance', short: 'Advance', className: 'badge-orange', hint: 'Given now, taken back from salary', paid: true },
  bata: { label: 'Bata / Allowance', short: 'Bata', className: 'badge-blue', hint: 'Daily allowance paid in cash, outside salary', paid: true },
  bonus: { label: 'Bonus / Extra', short: 'Bonus', className: 'badge-gray', hint: 'Incentive, overtime, extra trip pay: added to salary owed', paid: false },
  deduction: { label: 'Deduction', short: 'Deduction', className: 'badge-red', hint: 'Fine, challan, damage: taken off salary owed', paid: false },
};
