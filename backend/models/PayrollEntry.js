const { Schema, ObjectId, owner, ref, text, makeModel } = require("./schemaHelpers");

/**
 * Money and adjustments for an employee, counted in the salary month they belong to.
 * salary / advance: paid out, reduce what is owed. bonus: adds to what is owed (incentive, overtime).
 * deduction: reduces what is owed (fine, damage). bata: daily allowance paid in cash, outside the salary.
 * Salary, advance and bata are booked as an expense of the vehicle.
 */
const payrollEntrySchema = new Schema(
  {
    ...owner,
    employeeId: { type: ObjectId, ref: "Employee", required: true },
    date: { type: Date, required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    type: { type: String, enum: ["salary", "advance", "bonus", "deduction", "bata"], required: true },
    amount: { type: Number, required: true, min: 0 },
    mode: { type: String, enum: ["cash", "bank", "upi", "cheque"], default: "cash" },
    vehicleId: ref("Vehicle"),
    notes: text,
  },
  { timestamps: true }
);
payrollEntrySchema.index({ userId: 1, month: 1 });

const PayrollEntry = makeModel("PayrollEntry", payrollEntrySchema);

module.exports = PayrollEntry;
