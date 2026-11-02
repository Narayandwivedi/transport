const express = require("express");
const { Employee, Attendance, PayrollEntry, Expense, Vehicle } = require("../models");
const crudRouter = require("../utils/crud");
const { dateFilter, currentMonth } = require("../utils/common");
const { salarySheet, syncPayrollExpense, syncVehicleDriver, monthOf } = require("../utils/payroll");

const router = express.Router();

const refuse = (message) => Object.assign(new Error(message), { status: 400 });

router.get("/sheet", async (req, res) => {
  res.json(await salarySheet(req.userId, req.query.month || currentMonth()));
});

/* ───────── Attendance ───────── */
router.get("/attendance", async (req, res) => {
  const marks = await Attendance.find({ userId: req.userId, ...dateFilter("date", req.query.from, req.query.to) }).lean();
  res.json(marks.map((mark) => ({ employeeId: String(mark.employeeId), date: mark.date.toISOString().slice(0, 10), status: mark.status })));
});

// marks: [{ employeeId, date, status }]; an empty status clears that day's mark
router.post("/attendance", async (req, res) => {
  const marks = Array.isArray(req.body.marks) ? req.body.marks : [];
  const ids = [...new Set(marks.map((mark) => String(mark.employeeId)))];
  const owned = await Employee.countDocuments({ userId: req.userId, _id: { $in: ids } });
  if (owned !== ids.length) throw refuse("Employee not found");
  await Promise.all(marks.map((mark) => {
    const filter = { userId: req.userId, employeeId: mark.employeeId, date: new Date(mark.date) };
    if (!mark.status) return Attendance.deleteOne(filter);
    return Attendance.updateOne(filter, { $set: { status: mark.status } }, { upsert: true, runValidators: true });
  }));
  res.json({ success: true });
});

/* ───────── Employees ───────── */
router.use("/employees", crudRouter(Employee, {
  sort: { isActive: -1, name: 1 },
  populate: "vehicleId",
  filters: ["role", "vehicleId"],
  searchFields: ["name", "mobile", "licenseNo"],
  prepare: async (req, data) => {
    if (data.vehicleId && !(await Vehicle.exists({ _id: data.vehicleId, userId: req.userId }))) throw refuse("Vehicle not found");
    if (data.isActive === true || data.isActive === "true") data.leftDate = null;
    return data;
  },
  afterSave: (req, doc) => syncVehicleDriver(req.userId, doc),
  beforeDelete: async (req, doc) => {
    const used = await PayrollEntry.exists({ userId: req.userId, employeeId: doc._id })
      || await Attendance.exists({ userId: req.userId, employeeId: doc._id });
    return used ? "This employee has attendance or payments. Mark them as left instead." : "";
  },
}));

/* ───────── Salary, advance, bata, bonus, deduction ───────── */
router.use("/entries", crudRouter(PayrollEntry, {
  sort: { date: -1, createdAt: -1 },
  populate: "employeeId vehicleId",
  dateField: "date",
  filters: ["employeeId", "type", "month"],
  prepare: async (req, data) => {
    const employee = await Employee.findOne({ _id: data.employeeId, userId: req.userId }).lean();
    if (!employee) throw refuse("Pick an employee");
    if (!data.month && data.date) data.month = monthOf(data.date);
    // Booked to the vehicle they work on unless another is picked
    if (data.vehicleId === undefined) data.vehicleId = employee.vehicleId || null;
    return data;
  },
  afterSave: (req, doc) => syncPayrollExpense(req.userId, doc),
  afterDelete: (req, doc) => Expense.deleteMany({ userId: req.userId, payrollEntryId: doc._id }),
}));

module.exports = router;
