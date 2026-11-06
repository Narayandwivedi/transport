const mongoose = require("mongoose");
const { Employee, Attendance, PayrollEntry, Expense, Vehicle, Trip } = require("../models");
const { dateFilter, currentMonth } = require("../utils/common");
const { refuse } = require("../utils/guards");
const { salarySheet, syncPayrollExpense, syncVehicleDriver, monthOf } = require("../utils/payroll");

// GET /payroll/sheet?month=YYYY-MM: each employee's salary for the month
const sheet = async (req, res) => {
  res.json(await salarySheet(req.userId, req.query.month || currentMonth()));
};

const listAttendance = async (req, res) => {
  const marks = await Attendance.find({ userId: req.userId, ...dateFilter("date", req.query.from, req.query.to) }).lean();
  res.json(marks.map((mark) => ({ employeeId: String(mark.employeeId), date: mark.date.toISOString().slice(0, 10), status: mark.status })));
};

// marks: [{ employeeId, date, status }]; an empty status clears that day's mark
const saveAttendance = async (req, res) => {
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
};

// Trips driven by each driver: how many, and the last one's date
const driverTrips = async (req, res) => {
  const rows = await Trip.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(req.userId)), driverId: { $ne: null } } },
    { $group: { _id: "$driverId", trips: { $sum: 1 }, lastTrip: { $max: "$date" } } },
  ]);
  res.json(rows.map((row) => ({ driverId: String(row._id), trips: row.trips, lastTrip: row.lastTrip })));
};

// Drivers and staff
const employeeCrudOptions = {
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
    if (used) return "This employee has attendance or payments. Mark them as left instead.";
    return (await Trip.exists({ userId: req.userId, driverId: doc._id })) ? "This driver is on trips. Mark them as left instead." : "";
  },
};

// Salary, advance, bata, bonus, deduction
const entryCrudOptions = {
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
};

module.exports = { sheet, listAttendance, saveAttendance, driverTrips, employeeCrudOptions, entryCrudOptions };
