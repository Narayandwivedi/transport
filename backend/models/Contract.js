const { Schema, ObjectId, owner, text, makeModel } = require("./schemaHelpers");

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

const Contract = makeModel("Contract", contractSchema);

module.exports = Contract;
