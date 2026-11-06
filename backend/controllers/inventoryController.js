const { InventoryItem, InventoryTxn, Expense } = require("../models");
const { round2, toNumber, idOf } = require("../utils/common");
const { refuse, ownVehicle, usedBy } = require("../utils/guards");
const { refreshVehicleKm, refreshItem } = require("../utils/stock");

// Stock items: tyres, diesel, oil, spares
const itemCrudOptions = {
  sort: { name: 1 },
  filters: ["category"],
  searchFields: ["name"],
  prepare: async (req, data) => {
    // Stock and rate come from purchases and issues only
    delete data.stockQty;
    delete data.avgRate;
    return data;
  },
  beforeDelete: (req, doc) => usedBy([[InventoryTxn, { userId: req.userId, itemId: doc._id }, "purchases / issues"]]),
};

// Stock in (purchase) and out (issue to a vehicle). Lines of a purchase bill are changed through the bill.
const txnCrudOptions = {
  sort: { date: -1, createdAt: -1 },
  populate: "itemId vehicleId partyId",
  dateField: "date",
  filters: ["itemId", "type", "vehicleId", "partyId", "purchaseId"],
  canChange: (doc) => (doc.purchaseId ? "This line is part of a purchase bill. Change it in Purchases." : ""),
  prepare: async (req, data) => {
    delete data.purchaseId;
    const item = await InventoryItem.findOne({ _id: data.itemId, userId: req.userId }).lean();
    if (!item) throw refuse("Pick an item");
    if (!(toNumber(data.quantity) > 0)) throw refuse("Enter the quantity");
    if (data.type === "issue") {
      await ownVehicle(req, data.vehicleId);
      data.partyId = null;
    } else {
      data.vehicleId = null;
      data.odometer = 0;
      data.amount = round2(toNumber(data.quantity) * toNumber(data.rate));
    }
    return data;
  },
  afterSave: async (req, doc, old) => {
    await refreshItem(req.userId, doc.itemId);
    if (old && idOf(old.itemId) !== idOf(doc.itemId)) await refreshItem(req.userId, old.itemId);
    // An issue changed to a purchase no longer costs a vehicle anything
    if (doc.type !== "issue") await Expense.deleteMany({ userId: req.userId, inventoryTxnId: doc._id });
    await refreshVehicleKm(req.userId, doc.vehicleId);
    if (old?.vehicleId && idOf(old.vehicleId) !== idOf(doc.vehicleId)) await refreshVehicleKm(req.userId, old.vehicleId);
  },
  afterDelete: async (req, doc) => {
    await Expense.deleteMany({ userId: req.userId, inventoryTxnId: doc._id });
    await refreshItem(req.userId, doc.itemId);
    await refreshVehicleKm(req.userId, doc.vehicleId);
  },
};

module.exports = { itemCrudOptions, txnCrudOptions };
