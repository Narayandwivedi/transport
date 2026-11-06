const { Schema, ObjectId, owner, ref, money, text, makeModel } = require("./schemaHelpers");

/**
 * A purchase bill: stock items bought from a supplier (or for cash) in one go.
 * Each line adds stock through a linked InventoryTxn; the bill total goes to the supplier ledger,
 * less whatever was paid on the spot.
 */
const purchaseSchema = new Schema(
  {
    ...owner,
    purchaseNo: { type: String, trim: true, required: true },
    date: { type: Date, required: true },
    // Empty: a cash purchase with no party saved
    partyId: ref("Party"),
    supplierInvoice: text,
    items: [
      {
        _id: false,
        itemId: { type: ObjectId, ref: "InventoryItem", required: true },
        name: text,
        unit: text,
        quantity: { type: Number, required: true, min: 0 },
        rate: money,
        amount: money,
      },
    ],
    totalAmount: money,
    // Paid on the spot; the rest is owed to the supplier
    paidAmount: money,
    mode: { type: String, enum: ["cash", "bank", "upi", "cheque"], default: "cash" },
    notes: text,
  },
  { timestamps: true }
);
purchaseSchema.index({ userId: 1, date: -1 });

const Purchase = makeModel("Purchase", purchaseSchema);

module.exports = Purchase;
