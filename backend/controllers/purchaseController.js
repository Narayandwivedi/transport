const { Party, InventoryItem, InventoryTxn } = require("../models");
const { round2, toNumber, idOf } = require("../utils/common");
const { refuse } = require("../utils/guards");
const { refreshItem } = require("../utils/stock");

// Rebuilds a bill's stock lines, then the stock of every item the bill touches (now or before an edit)
const syncPurchaseStock = async (req, doc, old) => {
  await InventoryTxn.deleteMany({ userId: req.userId, purchaseId: doc._id });
  await InventoryTxn.insertMany((doc.items || []).map((line) => ({
    userId: req.userId,
    date: doc.date,
    type: "purchase",
    itemId: line.itemId,
    quantity: line.quantity,
    rate: line.rate,
    amount: line.amount,
    partyId: doc.partyId || null,
    // The bill itself carries the supplier balance, so its lines never count in the ledger again
    paidNow: true,
    purchaseId: doc._id,
    notes: [doc.purchaseNo, doc.supplierInvoice ? `Bill ${doc.supplierInvoice}` : ""].filter(Boolean).join(" · "),
  })));
  const itemIds = new Set([...(doc.items || []), ...(old?.items || [])].map((line) => idOf(line.itemId)));
  for (const itemId of itemIds) await refreshItem(req.userId, itemId);
};

// Purchase bills: one bill, many stock items
const crudOptions = {
  sort: { date: -1, createdAt: -1 },
  populate: "partyId",
  dateField: "date",
  filters: ["partyId"],
  searchFields: ["purchaseNo", "supplierInvoice", "notes"],
  number: { field: "purchaseNo", key: "purchase", prefix: "PUR" },
  prepare: async (req, data, old) => {
    if (old) delete data.purchaseNo;
    const lines = Array.isArray(data.items) ? data.items : [];
    const itemIds = lines.map((line) => line.itemId).filter(Boolean);
    const items = await InventoryItem.find({ userId: req.userId, _id: { $in: itemIds } }).lean();
    const byId = new Map(items.map((item) => [String(item._id), item]));
    data.items = lines
      .filter((line) => line.itemId || toNumber(line.quantity) > 0)
      .map((line) => {
        const item = byId.get(String(line.itemId));
        if (!item) throw refuse("Pick a stock item on every line");
        const quantity = toNumber(line.quantity);
        if (!(quantity > 0)) throw refuse(`Enter the quantity of ${item.name}`);
        const rate = toNumber(line.rate);
        if (rate < 0) throw refuse(`Rate of ${item.name} cannot be negative`);
        return { itemId: item._id, name: item.name, unit: item.unit, quantity, rate, amount: round2(quantity * rate) };
      });
    if (!data.items.length) throw refuse("Add at least one item");
    if (data.partyId && !(await Party.exists({ _id: data.partyId, userId: req.userId }))) throw refuse("Supplier not found");
    data.totalAmount = round2(data.items.reduce((total, line) => total + line.amount, 0));
    // With no supplier saved there is no one to owe: the bill is paid in full
    data.paidAmount = data.partyId ? Math.max(0, round2(toNumber(data.paidAmount))) : data.totalAmount;
    return data;
  },
  afterSave: syncPurchaseStock,
  afterDelete: async (req, doc) => {
    await InventoryTxn.deleteMany({ userId: req.userId, purchaseId: doc._id });
    for (const itemId of new Set((doc.items || []).map((line) => idOf(line.itemId)))) await refreshItem(req.userId, itemId);
  },
};

module.exports = { crudOptions };
