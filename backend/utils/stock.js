const { Vehicle, Trip, MeterReading, InventoryItem, InventoryTxn, Expense, Maintenance } = require("../models");
const { round2, toNumber } = require("./common");

// A vehicle's odometer is the highest reading seen anywhere: meter readings, trip end km, stock fitted, expenses
const refreshVehicleKm = async (userId, vehicleId) => {
  if (!vehicleId) return;
  const [meter, trip, issue, expense] = await Promise.all([
    MeterReading.findOne({ userId, vehicleId }).sort({ reading: -1 }).select("reading").lean(),
    Trip.findOne({ userId, vehicleId }).sort({ endKm: -1 }).select("endKm").lean(),
    InventoryTxn.findOne({ userId, vehicleId }).sort({ odometer: -1 }).select("odometer").lean(),
    Expense.findOne({ userId, vehicleId }).sort({ odometer: -1 }).select("odometer").lean(),
  ]);
  const maintenance = await Maintenance.findOne({ userId, vehicleId }).sort({ lastDoneKm: -1 }).select("lastDoneKm").lean();
  const currentKm = Math.max(
    0,
    toNumber(meter?.reading),
    toNumber(trip?.endKm),
    toNumber(issue?.odometer),
    toNumber(expense?.odometer),
    toNumber(maintenance?.lastDoneKm)
  );
  await Vehicle.updateOne({ _id: vehicleId, userId }, { $set: { currentKm } });
};

const EXPENSE_CATEGORY_FOR_ITEM = {
  tyre: "Tyre",
  diesel: "Diesel",
  oil: "Oil & Lubricants",
  spare: "Spare Parts",
  battery: "Battery",
  other: "Store Items",
};

/**
 * Replays an item's purchases and issues in date order: stock in hand, the average purchase rate,
 * and the cost of each issue at the average rate of its day. Each issue to a vehicle keeps one linked expense,
 * so the vehicle's profit counts the tyre / diesel it used.
 */
const refreshItem = async (userId, itemId) => {
  const item = await InventoryItem.findOne({ _id: itemId, userId });
  if (!item) return;
  const txns = await InventoryTxn.find({ userId, itemId }).sort({ date: 1, createdAt: 1 });
  let stock = 0;
  let avg = 0;
  for (const txn of txns) {
    const qty = toNumber(txn.quantity);
    if (txn.type === "purchase") {
      const rate = toNumber(txn.rate);
      avg = stock + qty > 0 && stock >= 0 ? (stock * avg + qty * rate) / (stock + qty) : rate;
      stock += qty;
      if (txn.amount !== round2(qty * rate)) {
        txn.amount = round2(qty * rate);
        await txn.save();
      }
      continue;
    }
    stock -= qty;
    const rate = round2(avg);
    const amount = round2(qty * avg);
    if (txn.rate !== rate || txn.amount !== amount) {
      txn.rate = rate;
      txn.amount = amount;
      await txn.save();
    }
    await syncIssueExpense(userId, txn, item);
  }
  item.stockQty = round2(stock);
  item.avgRate = round2(avg);
  await item.save();
};

const syncIssueExpense = async (userId, txn, item) => {
  const data = {
    userId,
    date: txn.date,
    vehicleId: txn.vehicleId || null,
    category: EXPENSE_CATEGORY_FOR_ITEM[item.category] || "Store Items",
    amount: toNumber(txn.amount),
    odometer: toNumber(txn.odometer),
    paidTo: "From store",
    mode: "cash",
    notes: `${item.name} × ${txn.quantity} ${item.unit}${txn.notes ? ` · ${txn.notes}` : ""}`,
    source: "inventory",
    inventoryTxnId: txn._id,
  };
  await Expense.findOneAndUpdate({ userId, inventoryTxnId: txn._id }, { $set: data }, { upsert: true });
};

module.exports = { refreshVehicleKm, refreshItem };
