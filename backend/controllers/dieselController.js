const { Party, Expense } = require("../models");
const { round2, toNumber, idOf } = require("../utils/common");
const { refuse, ownVehicle } = require("../utils/guards");
const { refreshVehicleKm } = require("../utils/stock");

// Each diesel purchase keeps one Diesel expense on its vehicle
const syncDieselExpense = async (userId, entry) => {
  const pump = entry.partyId ? await Party.findOne({ _id: entry.partyId, userId }).select("name").lean() : null;
  const data = {
    userId,
    date: entry.date,
    vehicleId: entry.vehicleId,
    category: "Diesel",
    amount: toNumber(entry.amount),
    odometer: toNumber(entry.meterReading),
    paidTo: pump?.name || "Petrol pump",
    mode: entry.mode,
    notes: [`${entry.entryNo} · ${toNumber(entry.litres)} ltr × ₹${toNumber(entry.rate)}`, entry.billNo ? `Bill ${entry.billNo}` : "", entry.notes].filter(Boolean).join(" · "),
    source: "diesel",
    dieselEntryId: entry._id,
  };
  await Expense.findOneAndUpdate({ userId, dieselEntryId: entry._id }, { $set: data }, { upsert: true });
};

// Diesel purchase: filled at a pump straight into a vehicle
const crudOptions = {
  sort: { date: -1, createdAt: -1 },
  populate: "vehicleId partyId",
  dateField: "date",
  filters: ["vehicleId", "partyId", "mode"],
  searchFields: ["entryNo", "billNo", "notes"],
  number: { field: "entryNo", key: "diesel", prefix: "DSL" },
  prepare: async (req, data, old) => {
    if (old) delete data.entryNo;
    if (!data.vehicleId) throw refuse("Pick the vehicle");
    await ownVehicle(req, data.vehicleId);
    if (data.partyId && !(await Party.exists({ _id: data.partyId, userId: req.userId }))) throw refuse("Petrol pump not found");
    const litres = toNumber(data.litres);
    if (!(litres > 0)) throw refuse("Enter the litres");
    // Rate given: amount = litres × rate. Only the amount given: the rate is worked out from it.
    let rate = toNumber(data.rate);
    let amount = toNumber(data.amount);
    if (rate > 0) amount = round2(litres * rate);
    else if (amount > 0) rate = round2(amount / litres);
    if (!(amount > 0)) throw refuse("Enter the rate or the amount");
    data.litres = litres;
    data.rate = rate;
    data.amount = amount;
    if (data.mode === "credit" && !data.partyId) throw refuse("Pick the petrol pump to fill on credit");
    return data;
  },
  afterSave: async (req, doc, old) => {
    await syncDieselExpense(req.userId, doc);
    await refreshVehicleKm(req.userId, doc.vehicleId);
    if (old && idOf(old.vehicleId) !== idOf(doc.vehicleId)) await refreshVehicleKm(req.userId, old.vehicleId);
  },
  afterDelete: async (req, doc) => {
    await Expense.deleteMany({ userId: req.userId, dieselEntryId: doc._id });
    await refreshVehicleKm(req.userId, doc.vehicleId);
  },
};

module.exports = { crudOptions };
