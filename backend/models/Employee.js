const { Schema, owner, ref, money, text, makeModel } = require("./schemaHelpers");

const EMPLOYEE_ROLES = ["driver", "helper", "mechanic", "supervisor", "office", "other"];

const employeeSchema = new Schema(
  {
    ...owner,
    name: { type: String, trim: true, required: true },
    mobile: text,
    role: { type: String, enum: EMPLOYEE_ROLES, default: "driver" },
    // The vehicle a driver / helper works on; their salary is booked to it
    vehicleId: ref("Vehicle"),
    // monthly: fixed salary, less absent days. daily: wage × days present.
    salaryType: { type: String, enum: ["monthly", "daily"], default: "monthly" },
    rate: money,
    joinDate: { type: Date, default: null },
    leftDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    licenseNo: { type: String, trim: true, uppercase: true, default: "" },
    licenseExpiry: { type: Date, default: null },
    // Unpaid salary (or advance outstanding, negative) from before this software
    openingBalance: { type: Number, default: 0 },
    address: text,
    notes: text,
  },
  { timestamps: true }
);

const Employee = makeModel("Employee", employeeSchema);

module.exports = Employee;
module.exports.EMPLOYEE_ROLES = EMPLOYEE_ROLES;
