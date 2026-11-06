const { Schema, owner, money, text, makeModel } = require("./schemaHelpers");

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

const InventoryItem = makeModel("InventoryItem", inventoryItemSchema);

module.exports = InventoryItem;
