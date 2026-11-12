const { Schema, ObjectId, owner, ref, money, text, TRIP_BASES, makeModel } = require("./schemaHelpers");

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
    // Usually the party loads its own material; sometimes I supply it and bill it with the transport
    materialBy: { type: String, enum: ["party", "me"], default: "party" },
    // materialAmount: the selling price billed to the trip's party (partyId)
    materialAmount: money,
    // Where I bought the material I supplied: the supplier (empty = bought for cash / my own stock),
    // what it cost me, and what I paid the supplier on the spot (the rest is owed in the supplier's ledger)
    materialSupplierId: ref("Party"),
    materialCost: money,
    materialCostPaid: money,
    materialCostMode: { type: String, enum: ["cash", "upi", "bank"], default: "cash" },
    billingBasis: { type: String, enum: TRIP_BASES, default: "per_trip" },
    // Trips, km or tons as the basis asks; per ton per km: the tons, with the km in distanceKm
    quantity: { type: Number, default: 1, min: 0 },
    distanceKm: money,
    rate: money,
    // freightAmount: the transport charge; amount: what the party is billed (transport + any material I supplied)
    freightAmount: money,
    amount: money,
    // Paid by the party on the trip itself: all of it (full), some (partial) or nothing (credit).
    // What is not paid stays owed in the party's ledger.
    receivedAmount: money,
    receivedMode: { type: String, enum: ["cash", "bank", "upi", "cheque"], default: "cash" },
    paymentType: { type: String, enum: ["credit", "partial", "full"], default: "credit" },
    startKm: money,
    endKm: money,
    // Hired vehicle paid per trip / km / ton: what I owe its owner for this trip
    hireBasis: { type: String, enum: ["", ...TRIP_BASES], default: "" },
    hireQuantity: money,
    hireRate: money,
    hireAmount: money,
    hirePartyId: ref("Party"),
    // The driver (an employee with work "driver") who drove this trip
    driverId: ref("Employee"),
    // No longer asked on Add Trip; kept for trips saved earlier
    driverAdvance: money,
    // Spends on the way (toll, puncture, loading…); each is also kept as an Expense on the vehicle
    expenses: [
      {
        _id: false,
        category: { type: String, trim: true, required: true },
        amount: money,
        notes: text,
        // When it happened, if not on the trip's date (a tyre puncture records its own date)
        date: { type: Date, default: null },
      },
    ],
    expenseTotal: money,
    status: { type: String, enum: ["planned", "running", "completed"], default: "completed" },
    notes: text,
  },
  { timestamps: true }
);
tripSchema.index({ userId: 1, date: -1 });

const Trip = makeModel("Trip", tripSchema);

module.exports = Trip;
