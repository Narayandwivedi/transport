const { Schema, ObjectId, owner, ref, money, text, makeModel } = require("./schemaHelpers");

/**
 * Diesel bought at a petrol pump straight into a vehicle (it never goes into stock).
 * Keeps one linked expense on the vehicle; on credit, the amount is owed to the pump.
 */
const dieselEntrySchema = new Schema(
  {
    ...owner,
    entryNo: { type: String, trim: true, required: true },
    date: { type: Date, required: true },
    vehicleId: { type: ObjectId, ref: "Vehicle", required: true },
    // The petrol pump (a party); empty when not saved
    partyId: ref("Party"),
    // The trip this diesel was filled for; empty when filled without a trip
    tripId: ref("Trip"),
    litres: { type: Number, required: true, min: 0 },
    rate: money,
    amount: money,
    // Vehicle's km / hour meter at the pump (optional)
    meterReading: money,
    // credit: owed to the pump, shows in its ledger
    mode: { type: String, enum: ["cash", "upi", "bank", "credit"], default: "cash" },
    billNo: text,
    notes: text,
  },
  { timestamps: true }
);
dieselEntrySchema.index({ userId: 1, date: -1 });
dieselEntrySchema.index({ userId: 1, vehicleId: 1, date: -1 });
dieselEntrySchema.index({ userId: 1, tripId: 1 });

const DieselEntry = makeModel("DieselEntry", dieselEntrySchema);

module.exports = DieselEntry;
