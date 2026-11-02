const mongoose = require("mongoose");

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

// Every record belongs to one account; all lists are filtered by it
const owner = { userId: { type: ObjectId, ref: "User", required: true, index: true } };
const ref = (model) => ({ type: ObjectId, ref: model, default: null });
const money = { type: Number, default: 0, min: 0 };
const text = { type: String, trim: true, default: "" };

// How a trip or a hired vehicle is charged
const BILLING_BASES = ["per_trip", "per_km", "per_ton", "fixed"];
// A trip can also be charged per ton per km (tons × km × rate) or per cubic foot (cft × rate)
const TRIP_BASES = [...BILLING_BASES, "per_ton_km", "per_cft"];

const userSchema = new Schema(
  {
    name: { type: String, trim: true, required: true },
    companyName: text,
    email: { type: String, trim: true, lowercase: true, default: "" },
    mobile: { type: String, trim: true, default: "" },
    password: { type: String, required: true },
    address: text,
    gstin: { type: String, trim: true, uppercase: true, default: "" },
    // Printed at the bottom of every quotation
    quotationTerms: text,
    // Days before expiry a document starts showing as "expiring soon"
    documentReminderDays: { type: Number, default: 15, min: 0 },
  },
  { timestamps: true }
);

const counterSchema = new Schema({
  ...owner,
  key: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
counterSchema.index({ userId: 1, key: 1 }, { unique: true });

const partySchema = new Schema(
  {
    ...owner,
    name: { type: String, trim: true, required: true },
    // customer: I carry goods for them. transporter: I hire vehicles from them. supplier: tyres, diesel, parts.
    type: { type: String, enum: ["customer", "transporter", "supplier", "other"], default: "customer" },
    mobile: text,
    address: text,
    gstin: { type: String, trim: true, uppercase: true, default: "" },
    // Positive: they owe me. Negative: I owe them.
    openingBalance: { type: Number, default: 0 },
    notes: text,
  },
  { timestamps: true }
);

const vehicleSchema = new Schema(
  {
    ...owner,
    vehicleNo: { type: String, trim: true, uppercase: true, required: true },
    category: { type: String, enum: ["truck", "trailer", "hyva", "tanker", "container", "pickup", "jcb", "other"], default: "truck" },
    // own: my vehicle. hired: taken from ownerPartyId (per trip / km / ton, or monthly through a hire contract)
    ownership: { type: String, enum: ["own", "hired"], default: "own" },
    ownerPartyId: ref("Party"),
    hireBasis: { type: String, enum: ["", ...BILLING_BASES], default: "" },
    hireRate: money,
    /**
     * Agreed rates for routes this vehicle runs, each per trip, per km or per ton:
     * what the party is billed, and for a hired vehicle what its owner is paid on the same basis.
     */
    routeRates: [
      {
        _id: false,
        from: { type: String, trim: true, required: true },
        to: { type: String, trim: true, required: true },
        basis: { type: String, enum: ["per_trip", "per_km", "per_ton"], default: "per_trip" },
        rate: money,
        hireRate: money,
        // Route length, used as the km of a per-km trip when no meter km is entered
        distanceKm: money,
      },
    ],
    make: text,
    model: text,
    capacityTons: money,
    // Latest odometer, kept up to date from meter readings and trips
    currentKm: money,
    driverName: text,
    driverMobile: text,
    status: { type: String, enum: ["active", "inactive", "sold"], default: "active" },
    notes: text,
  },
  { timestamps: true }
);
vehicleSchema.index({ userId: 1, vehicleNo: 1 }, { unique: true });

const tripSchema = new Schema(
  {
    ...owner,
    tripNo: { type: String, trim: true, required: true },
    date: { type: Date, required: true },
    vehicleId: { type: ObjectId, ref: "Vehicle", required: true },
    // Who I bill for the trip
    partyId: { type: ObjectId, ref: "Party", required: true },
    from: text,
    to: text,
    material: text,
    billingBasis: { type: String, enum: TRIP_BASES, default: "per_trip" },
    // Trips, km or tons as the basis asks; per ton per km: the tons, with the km in distanceKm
    quantity: { type: Number, default: 1, min: 0 },
    distanceKm: money,
    rate: money,
    amount: money,
    startKm: money,
    endKm: money,
    // Hired vehicle paid per trip / km / ton: what I owe its owner for this trip
    hireBasis: { type: String, enum: ["", ...TRIP_BASES], default: "" },
    hireQuantity: money,
    hireRate: money,
    hireAmount: money,
    hirePartyId: ref("Party"),
    driverAdvance: money,
    status: { type: String, enum: ["planned", "running", "completed"], default: "completed" },
    notes: text,
  },
  { timestamps: true }
);
tripSchema.index({ userId: 1, date: -1 });

/**
 * A vehicle on monthly rent.
 * hire_in: I take a vehicle from a party and pay them each month (payable).
 * give_out: I give a vehicle (my own, or one I hired in) to a party and charge them each month (receivable).
 */
const contractSchema = new Schema(
  {
    ...owner,
    contractNo: { type: String, trim: true, required: true },
    direction: { type: String, enum: ["hire_in", "give_out"], required: true },
    vehicleId: { type: ObjectId, ref: "Vehicle", required: true },
    partyId: { type: ObjectId, ref: "Party", required: true },
    monthlyRate: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    // Empty: runs until stopped
    endDate: { type: Date, default: null },
    // Diesel and driver: who bears them is noted for the record
    dieselBy: { type: String, enum: ["owner", "hirer"], default: "hirer" },
    driverBy: { type: String, enum: ["owner", "hirer"], default: "owner" },
    notes: text,
  },
  { timestamps: true }
);

const paymentSchema = new Schema(
  {
    ...owner,
    date: { type: Date, required: true },
    partyId: { type: ObjectId, ref: "Party", required: true },
    // received: money in from the party. paid: money out to the party.
    type: { type: String, enum: ["received", "paid"], required: true },
    amount: { type: Number, required: true, min: 0 },
    mode: { type: String, enum: ["cash", "bank", "upi", "cheque"], default: "cash" },
    reference: text,
    notes: text,
  },
  { timestamps: true }
);

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
    source: { type: String, enum: ["manual", "inventory", "maintenance", "payroll"], default: "manual" },
    inventoryTxnId: ref("InventoryTxn"),
    // payroll: salary / advance / bata paid to an employee; it is changed in Payroll
    payrollEntryId: ref("PayrollEntry"),
  },
  { timestamps: true }
);
expenseSchema.index({ userId: 1, date: -1 });

const inventoryItemSchema = new Schema(
  {
    ...owner,
    name: { type: String, trim: true, required: true },
    category: { type: String, enum: ["tyre", "diesel", "oil", "spare", "battery", "other"], default: "other" },
    unit: { type: String, trim: true, default: "pcs" },
    stockQty: { type: Number, default: 0 },
    // Weighted average purchase rate; issued stock is costed at it
    avgRate: money,
    minStock: money,
    notes: text,
  },
  { timestamps: true }
);

const inventoryTxnSchema = new Schema(
  {
    ...owner,
    date: { type: Date, required: true },
    type: { type: String, enum: ["purchase", "issue"], required: true },
    itemId: { type: ObjectId, ref: "InventoryItem", required: true },
    quantity: { type: Number, required: true, min: 0 },
    rate: money,
    amount: money,
    // purchase: bought from this supplier (on credit unless paid in cash)
    partyId: ref("Party"),
    paidNow: { type: Boolean, default: true },
    // issue: fitted / filled in this vehicle
    vehicleId: ref("Vehicle"),
    odometer: money,
    notes: text,
  },
  { timestamps: true }
);

// One day's (or trip's) run of a vehicle: odometer at the start and at the end
const meterReadingSchema = new Schema(
  {
    ...owner,
    vehicleId: { type: ObjectId, ref: "Vehicle", required: true },
    date: { type: Date, required: true },
    openingReading: { type: Number, min: 0, default: null },
    // null while the vehicle is still out: the closing is filled in at the end of the day
    closingReading: { type: Number, min: 0, default: null },
    // The highest km this entry shows (closing, or opening while still open); the odometer is worked out from it
    reading: { type: Number, min: 0, default: 0 },
    notes: text,
  },
  { timestamps: true }
);
meterReadingSchema.pre("validate", function setReading() {
  // Entries saved before opening / closing existed had only "reading": it is their closing
  if (this.openingReading === null && this.closingReading === null) this.closingReading = this.reading;
  this.reading = this.closingReading ?? this.openingReading ?? 0;
});
meterReadingSchema.index({ userId: 1, vehicleId: 1, date: -1 });

// Service due every N km and/or every N days, counted from when it was last done
const maintenanceSchema = new Schema(
  {
    ...owner,
    vehicleId: { type: ObjectId, ref: "Vehicle", required: true },
    title: { type: String, trim: true, required: true },
    intervalKm: money,
    intervalDays: money,
    lastDoneKm: money,
    lastDoneDate: { type: Date, default: null },
    // Warn this many km / days before it falls due
    alertBeforeKm: { type: Number, default: 500, min: 0 },
    alertBeforeDays: { type: Number, default: 7, min: 0 },
    history: [
      {
        _id: false,
        date: Date,
        km: Number,
        cost: Number,
        notes: String,
      },
    ],
    notes: text,
  },
  { timestamps: true }
);

const DOCUMENT_TYPES = ["tax", "insurance", "fitness", "puc", "gps", "permit", "rc", "national_permit", "other"];

const documentSchema = new Schema(
  {
    ...owner,
    vehicleId: { type: ObjectId, ref: "Vehicle", required: true },
    docType: { type: String, enum: DOCUMENT_TYPES, required: true },
    docNumber: text,
    provider: text,
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    amount: money,
    file: text,
    fileName: text,
    notes: text,
  },
  { timestamps: true }
);

const quotationSchema = new Schema(
  {
    ...owner,
    quoteNo: { type: String, trim: true, required: true },
    date: { type: Date, required: true },
    validTill: { type: Date, default: null },
    partyId: ref("Party"),
    // For someone not saved as a party yet
    customerName: text,
    customerAddress: text,
    subject: text,
    items: [
      {
        _id: false,
        description: text,
        from: text,
        to: text,
        vehicleType: text,
        basis: { type: String, enum: [...BILLING_BASES, "per_month"], default: "per_trip" },
        quantity: { type: Number, default: 1, min: 0 },
        rate: money,
        amount: money,
      },
    ],
    gstPercent: { type: Number, default: 0, min: 0 },
    discount: money,
    terms: text,
    notes: text,
    status: { type: String, enum: ["draft", "sent", "accepted", "rejected"], default: "draft" },
  },
  { timestamps: true }
);

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

const attendanceSchema = new Schema({
  ...owner,
  employeeId: { type: ObjectId, ref: "Employee", required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ["present", "half", "absent"], required: true },
});
attendanceSchema.index({ userId: 1, employeeId: 1, date: 1 }, { unique: true });

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

const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

module.exports = {
  BILLING_BASES,
  DOCUMENT_TYPES,
  EMPLOYEE_ROLES,
  User: model("User", userSchema),
  Counter: model("Counter", counterSchema),
  Party: model("Party", partySchema),
  Vehicle: model("Vehicle", vehicleSchema),
  Trip: model("Trip", tripSchema),
  Contract: model("Contract", contractSchema),
  Payment: model("Payment", paymentSchema),
  Expense: model("Expense", expenseSchema),
  InventoryItem: model("InventoryItem", inventoryItemSchema),
  InventoryTxn: model("InventoryTxn", inventoryTxnSchema),
  MeterReading: model("MeterReading", meterReadingSchema),
  Maintenance: model("Maintenance", maintenanceSchema),
  Document: model("Document", documentSchema),
  Quotation: model("Quotation", quotationSchema),
  Employee: model("Employee", employeeSchema),
  Attendance: model("Attendance", attendanceSchema),
  PayrollEntry: model("PayrollEntry", payrollEntrySchema),
};
