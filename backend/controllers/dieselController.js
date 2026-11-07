const { Party, Expense, Trip } = require("../models");
const { round2, toNumber, idOf } = require("../utils/common");
const { refuse, ownVehicle } = require("../utils/guards");
const { refreshVehicleKm } = require("../utils/stock");

// Each diesel purchase keeps one Diesel expense on its vehicle
const syncDieselExpense = async (userId, entry) => {
  const pump = entry.partyId ? await Party.findOne({ _id: entry.partyId, userId }).select("name").lean() : null;
  const trip = entry.tripId ? await Trip.findOne({ _id: entry.tripId, userId }).select("tripNo from to").lean() : null;
  const route = trip ? [trip.from, trip.to].filter(Boolean).join(" → ") : "";
  const data = {
    userId,
    date: entry.date,
    vehicleId: entry.vehicleId,
    category: "Diesel",
    amount: toNumber(entry.amount),
    odometer: toNumber(entry.meterReading),
    paidTo: pump?.name || "Petrol pump",
    // Nothing paid at the pump: the cost is on credit
    mode: toNumber(entry.paidAmount) > 0 ? entry.mode : "credit",
    notes: [`${entry.entryNo} · ${toNumber(entry.litres)} ltr × ₹${toNumber(entry.rate)}`, trip ? `Trip ${trip.tripNo}${route ? ` (${route})` : ""}` : "", entry.billNo ? `Bill ${entry.billNo}` : "", entry.notes].filter(Boolean).join(" · "),
    source: "diesel",
    dieselEntryId: entry._id,
  };
  await Expense.findOneAndUpdate({ userId, dieselEntryId: entry._id }, { $set: data }, { upsert: true });
};

// Diesel purchase: filled at a pump straight into a vehicle
const crudOptions = {
  sort: { date: -1, createdAt: -1 },
  populate: "vehicleId partyId tripId",
  dateField: "date",
  filters: ["vehicleId", "partyId", "tripId", "mode"],
  searchFields: ["entryNo", "billNo", "notes"],
  number: { field: "entryNo", key: "diesel", prefix: "DSL" },
  prepare: async (req, data, old) => {
    if (old) delete data.entryNo;
    if (!data.vehicleId) throw refuse("Pick the vehicle");
    await ownVehicle(req, data.vehicleId);
    // The trip must be one of this vehicle's; none means filled without a trip
    if (data.tripId && !(await Trip.exists({ _id: data.tripId, userId: req.userId, vehicleId: data.vehicleId }))) throw refuse("That trip is not of this vehicle");
    if (!data.tripId) data.tripId = null;
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
    // Paid now: typed, or all of it when not given. Without a saved pump nothing can stay owed.
    const paidGiven = data.paidAmount !== undefined && data.paidAmount !== null && String(data.paidAmount).trim() !== "";
    const paid = paidGiven ? round2(Math.max(0, toNumber(data.paidAmount))) : amount;
    if (paid > amount) throw refuse(`Paid cannot be more than the amount (₹${amount})`);
    if (paid < amount && !data.partyId) throw refuse("Pick the petrol pump to keep the balance due");
    data.paidAmount = paid;
    data.paymentType = paid <= 0 ? "credit" : paid >= amount ? "full" : "partial";
    if (!["cash", "upi", "bank"].includes(data.mode)) data.mode = "cash";
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
