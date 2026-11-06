const express = require("express");
const { Employee, PayrollEntry } = require("../models");
const crudRouter = require("../utils/crud");
const {
  sheet, listAttendance, saveAttendance, driverTrips, employeeCrudOptions, entryCrudOptions,
} = require("../controllers/payrollController");

// Payroll: drivers and staff, attendance, salary and payments
const router = express.Router();

router.get("/sheet", sheet);
router.get("/attendance", listAttendance);
router.post("/attendance", saveAttendance);
router.get("/driver-trips", driverTrips);
router.use("/employees", crudRouter(Employee, employeeCrudOptions));
router.use("/entries", crudRouter(PayrollEntry, entryCrudOptions));

module.exports = router;
