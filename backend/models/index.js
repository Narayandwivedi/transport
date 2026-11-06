// One file per model; this gathers them so code can `require("../models")` and pick what it needs
const { BILLING_BASES } = require("./schemaHelpers");
const User = require("./User");
const Counter = require("./Counter");
const Party = require("./Party");
const Vehicle = require("./Vehicle");
const Material = require("./Material");
const Trip = require("./Trip");
const Contract = require("./Contract");
const Payment = require("./Payment");
const Expense = require("./Expense");
const InventoryItem = require("./InventoryItem");
const InventoryTxn = require("./InventoryTxn");
const Purchase = require("./Purchase");
const DieselEntry = require("./DieselEntry");
const MeterReading = require("./MeterReading");
const Maintenance = require("./Maintenance");
const Document = require("./Document");
const Quotation = require("./Quotation");
const Employee = require("./Employee");
const Attendance = require("./Attendance");
const PayrollEntry = require("./PayrollEntry");

module.exports = {
  BILLING_BASES,
  DOCUMENT_TYPES: Document.DOCUMENT_TYPES,
  EMPLOYEE_ROLES: Employee.EMPLOYEE_ROLES,
  User,
  Counter,
  Party,
  Vehicle,
  Material,
  Trip,
  Contract,
  Payment,
  Expense,
  InventoryItem,
  InventoryTxn,
  Purchase,
  DieselEntry,
  MeterReading,
  Maintenance,
  Document,
  Quotation,
  Employee,
  Attendance,
  PayrollEntry,
};
