const { Schema, owner, ref, money, text, BILLING_BASES, makeModel } = require("./schemaHelpers");

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

const Quotation = makeModel("Quotation", quotationSchema);

module.exports = Quotation;
