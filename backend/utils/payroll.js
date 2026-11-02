const { Employee, Attendance, PayrollEntry, Expense, Vehicle } = require("../models");
const { dayNum, todayNum, toNumber, monthRange, idOf } = require("./common");

const monthOf = (date) => new Date(date).toISOString().slice(0, 7);

const nextMonth = (month) => {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 7);
};

const EMPTY_MONTH = () => ({
  present: 0, half: 0, absent: 0, activeDays: 0, daysWorked: 0,
  earned: 0, bonus: 0, deduction: 0, advance: 0, paid: 0, bata: 0,
});

/**
 * One employee's salary for one month.
 * Monthly salary: the month's salary for the days they were on the job (from joining, till leaving, up to today),
 * less absent days and half of half days, at salary ÷ days in the month per day.
 * Daily wage: wage × (present days + half of half days).
 */
const monthSalary = (employee, month, marks, entries) => {
  const { from, to } = monthRange(month);
  const result = EMPTY_MONTH();
  marks.forEach((mark) => { result[mark.status] += 1; });
  entries.forEach((entry) => {
    const key = entry.type === "salary" ? "paid" : entry.type;
    result[key] += toNumber(entry.amount);
  });

  const daysInMonth = dayNum(to) - dayNum(from) + 1;
  const start = Math.max(dayNum(from), employee.joinDate ? dayNum(employee.joinDate) : -Infinity);
  const end = Math.min(dayNum(to), employee.leftDate ? dayNum(employee.leftDate) : Infinity, todayNum());
  result.activeDays = Math.max(0, end - start + 1);

  if (employee.salaryType === "daily") {
    result.daysWorked = result.present + result.half * 0.5;
    result.earned = Math.round(toNumber(employee.rate) * result.daysWorked);
  } else {
    result.daysWorked = Math.max(0, result.activeDays - result.absent - result.half * 0.5);
    result.earned = Math.round((toNumber(employee.rate) / daysInMonth) * result.daysWorked);
  }
  result.net = result.earned + result.bonus - result.deduction - result.advance - result.paid;
  return result;
};

/**
 * The salary sheet for a month. Whatever was not paid in earlier months (or advance not yet recovered)
 * is carried in as the opening balance, so nothing is lost between months.
 */
const salarySheet = async (userId, month) => {
  const { to } = monthRange(month);
  const [employees, marks, entries] = await Promise.all([
    Employee.find({ userId }).populate("vehicleId", "vehicleNo").sort({ isActive: -1, name: 1 }).lean(),
    Attendance.find({ userId, date: { $lte: to } }).lean(),
    PayrollEntry.find({ userId, month: { $lte: month } }).lean(),
  ]);

  const group = (rows, keyOf) => rows.reduce((map, row) => {
    const key = keyOf(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());
  const marksBy = group(marks, (mark) => `${idOf(mark.employeeId)}:${monthOf(mark.date)}`);
  const entriesBy = group(entries, (entry) => `${idOf(entry.employeeId)}:${entry.month}`);

  const rows = employees.map((employee) => {
    const id = String(employee._id);
    const firstMonths = [
      employee.joinDate ? monthOf(employee.joinDate) : null,
      ...marks.filter((mark) => idOf(mark.employeeId) === id).map((mark) => monthOf(mark.date)),
      ...entries.filter((entry) => idOf(entry.employeeId) === id).map((entry) => entry.month),
      monthOf(employee.createdAt),
    ].filter(Boolean).sort();
    let cursor = firstMonths[0] < month ? firstMonths[0] : month;
    let opening = toNumber(employee.openingBalance);
    let current = EMPTY_MONTH();
    // Months before this one only add to the opening balance
    while (cursor <= month) {
      const key = `${id}:${cursor}`;
      const calc = monthSalary(employee, cursor, marksBy.get(key) || [], entriesBy.get(key) || []);
      if (cursor === month) current = calc;
      else opening += calc.net;
      cursor = nextMonth(cursor);
    }
    return { employee, ...current, opening: Math.round(opening), closing: Math.round(opening + current.net) };
  }).filter((row) => row.employee.isActive || row.activeDays > 0 || row.closing !== 0 || row.paid || row.advance || row.bata);

  const sum = (field) => rows.reduce((total, row) => total + toNumber(row[field]), 0);
  return {
    month,
    rows,
    totals: {
      opening: sum("opening"),
      earned: sum("earned"),
      bonus: sum("bonus"),
      deduction: sum("deduction"),
      advance: sum("advance"),
      paid: sum("paid"),
      bata: sum("bata"),
      closing: sum("closing"),
    },
  };
};

const EXPENSE_FOR = { salary: "Salary", advance: "Salary Advance", bata: "Bata" };

// Salary, advance and bata leave the cash box: each keeps one expense on the vehicle the employee works on
const syncPayrollExpense = async (userId, entry) => {
  if (!EXPENSE_FOR[entry.type]) {
    await Expense.deleteMany({ userId, payrollEntryId: entry._id });
    return;
  }
  const employee = await Employee.findById(entry.employeeId).lean();
  const isDriver = employee?.role === "driver";
  const category = entry.type === "bata"
    ? "Driver Bata"
    : isDriver ? "Driver Salary" : "Staff Salary";
  await Expense.findOneAndUpdate(
    { userId, payrollEntryId: entry._id },
    {
      $set: {
        userId,
        date: entry.date,
        vehicleId: entry.vehicleId || null,
        category,
        amount: toNumber(entry.amount),
        paidTo: employee?.name || "",
        mode: entry.mode === "cheque" ? "bank" : entry.mode,
        notes: `${EXPENSE_FOR[entry.type]} · ${entry.month}${entry.notes ? ` · ${entry.notes}` : ""}`,
        source: "payroll",
        payrollEntryId: entry._id,
      },
    },
    { upsert: true }
  );
};

// A driver set on a vehicle shows as that vehicle's driver
const syncVehicleDriver = async (userId, employee) => {
  if (employee.role !== "driver" || !employee.vehicleId || !employee.isActive) return;
  await Vehicle.updateOne(
    { _id: employee.vehicleId, userId },
    { $set: { driverName: employee.name, driverMobile: employee.mobile || "" } }
  );
};

module.exports = { salarySheet, syncPayrollExpense, syncVehicleDriver, monthOf };
