const { Schema, owner, text, makeModel } = require("./schemaHelpers");

const partySchema = new Schema(
  {
    ...owner,
    name: { type: String, trim: true, required: true },
    // customer: I carry goods for them. transporter: I hire vehicles from them. supplier: tyres, diesel, parts.
    // pump: petrol pump where vehicles fill diesel, often on credit settled monthly
    type: { type: String, enum: ["customer", "transporter", "supplier", "pump", "other"], default: "customer" },
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
