const { Schema, ObjectId, owner, ref, money, text, makeModel } = require("./schemaHelpers");

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
    // purchase: a line of this purchase bill; it is changed through the bill
    purchaseId: ref("Purchase"),
    // issue: fitted / filled in this vehicle
    vehicleId: ref("Vehicle"),
    odometer: money,
    notes: text,
  },
  { timestamps: true }
);

const InventoryTxn = makeModel("InventoryTxn", inventoryTxnSchema);

module.exports = InventoryTxn;
