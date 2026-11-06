const { Schema, owner, ref, money, text, makeModel } = require("./schemaHelpers");

const expenseSchema = new Schema(
  {
    ...owner,
    date: { type: Date, required: true },
    // Empty: an office / general expense, counted only in the business profit
    vehicleId: ref("Vehicle"),
    category: { type: String, trim: true, required: true },
    amount: { type: Number, required: true, min: 0 },
    odometer: money,
    paidTo: text,
    mode: { type: String, enum: ["cash", "bank", "upi", "credit"], default: "cash" },
    notes: text,
    // inventory: made by issuing stock to the vehicle; it is changed through that issue, not on its own
    source: { type: String, enum: ["manual", "inventory", "maintenance", "payroll", "trip", "diesel"], default: "manual" },
    inventoryTxnId: ref("InventoryTxn"),
    // diesel: a diesel purchase at a pump; it is changed through that entry
    dieselEntryId: ref("DieselEntry"),
    // trip: a spend entered on a trip; it is changed through that trip
    tripId: ref("Trip"),
    // payroll: salary / advance / bata paid to an employee; it is changed in Payroll
    payrollEntryId: ref("PayrollEntry"),
  },
  { timestamps: true }
);
expenseSchema.index({ userId: 1, date: -1 });

const Expense = makeModel("Expense", expenseSchema);

module.exports = Expense;
