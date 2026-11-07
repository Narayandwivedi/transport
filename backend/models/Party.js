const { Schema, owner, text, makeModel } = require("./schemaHelpers");

const partySchema = new Schema(
  {
    ...owner,
    name: { type: String, trim: true, required: true },
    // customer: I bill them (trips, rent). supplier: I pay them (vehicle owners I hire from, petrol pumps, tyres, parts)
    type: { type: String, enum: ["customer", "supplier"], default: "customer" },
    mobile: text,
    address: text,
    gstin: { type: String, trim: true, uppercase: true, default: "" },
    // Positive: they owe me. Negative: I owe them.
    openingBalance: { type: Number, default: 0 },
    notes: text,
  },
  { timestamps: true }
);

const Party = makeModel("Party", partySchema);

module.exports = Party;
