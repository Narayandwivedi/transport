const { Schema, ObjectId, owner, text, makeModel } = require("./schemaHelpers");

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

const Payment = makeModel("Payment", paymentSchema);

module.exports = Payment;
