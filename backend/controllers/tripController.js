const { Expense, Employee, DieselEntry } = require("../models");
const { round2, toNumber, idOf, lineAmount, routeKey } = require("../utils/common");
const { refuse, ownVehicle } = require("../utils/guards");
const { refreshVehicleKm } = require("../utils/stock");

// A trip's expenses live as Expense records on its vehicle, so vehicle profit and reports count them
const syncTripExpenses = async (userId, trip) => {
  await Expense.deleteMany({ userId, tripId: trip._id });
  const route = [trip.from, trip.to].filter(Boolean).join(" → ");
  const rows = (trip.expenses || []).filter((row) => toNumber(row.amount) > 0);
  if (!rows.length) return;
  await Expense.insertMany(rows.map((row) => ({
    userId,
    date: trip.date,
    vehicleId: trip.vehicleId,
    category: row.category,
    amount: row.amount,
    notes: [`Trip ${trip.tripNo}${route ? ` (${route})` : ""}`, row.notes].filter(Boolean).join(" · "),
    source: "trip",
    tripId: trip._id,
  })));
};

const crudOptions = {
  sort: { date: -1, createdAt: -1 },
  populate: "vehicleId partyId hirePartyId driverId",
  dateField: "date",
  filters: ["vehicleId", "partyId", "status", "hirePartyId", "driverId", "paymentType"],
  searchFields: ["tripNo", "from", "to", "material", "notes"],
  number: { field: "tripNo", key: "trip", prefix: "TR" },
  prepare: async (req, data) => {
    const vehicle = await ownVehicle(req, data.vehicleId);
    if (!vehicle) throw refuse("Pick a vehicle");
    if (!data.partyId) throw refuse("Pick the party to bill");
    if (data.driverId && !(await Employee.exists({ _id: data.driverId, userId: req.userId }))) throw refuse("Driver not found");
    const startKm = toNumber(data.startKm);
    const endKm = toNumber(data.endKm);
    if (endKm && startKm && endKm < startKm) throw refuse("End km cannot be less than start km");
    // A trip on one of the vehicle's routes, charged the route's way, takes the route's rate when none was typed
    const route = (vehicle.routeRates || []).find((row) => routeKey(row) === routeKey(data));
    const routeBasis = route?.basis || "per_trip";
    if (route && (data.billingBasis || "per_trip") === routeBasis) {
      if (!toNumber(data.rate)) data.rate = route.rate;
      if (routeBasis === "per_km" && !toNumber(data.quantity)) data.quantity = route.distanceKm;
      if (vehicle.ownership === "hired" && route.hireRate && !data.hireBasis) {
        data.hireBasis = routeBasis;
        data.hireQuantity = data.quantity || 1;
      }
      if (data.hireBasis === routeBasis && !toNumber(data.hireRate)) data.hireRate = route.hireRate;
    }
    if (data.billingBasis === "per_ton_km" && !(toNumber(data.distanceKm) > 0)) throw refuse("Enter how many km");
    data.freightAmount = lineAmount(data.billingBasis, data.quantity, data.rate, data.distanceKm);
    // Material I supplied is billed to the party along with the transport
    if (data.materialBy === "me") {
      if (!String(data.material || "").trim()) throw refuse("Enter which material you supplied");
      data.materialAmount = round2(toNumber(data.materialAmount));
    } else {
      Object.assign(data, { materialBy: "party", materialAmount: 0 });
    }
    data.amount = round2(data.freightAmount + data.materialAmount);
    // Money the party paid on the trip: nothing = credit, all = full, some = partial
    const received = round2(Math.max(0, toNumber(data.receivedAmount)));
    if (received > data.amount) throw refuse(`Received cannot be more than the bill (₹${data.amount}). Enter any extra in Money Received.`);
    data.receivedAmount = received;
    data.paymentType = received <= 0 ? "credit" : received >= data.amount ? "full" : "partial";
    if (!["cash", "bank", "upi", "cheque"].includes(data.receivedMode)) data.receivedMode = "cash";
    // Only a hired vehicle paid per trip / km / ton costs hire on the trip
    if (vehicle.ownership === "hired" && data.hireBasis) {
      data.hirePartyId = data.hirePartyId || vehicle.ownerPartyId;
      data.hireAmount = lineAmount(data.hireBasis, data.hireQuantity, data.hireRate, data.distanceKm);
    } else {
      Object.assign(data, { hireBasis: "", hireQuantity: 0, hireRate: 0, hireAmount: 0, hirePartyId: null });
    }
    // Trip expenses: keep the rows with an amount, and their total
    data.expenses = (Array.isArray(data.expenses) ? data.expenses : [])
      .map((row) => ({ category: String(row.category || "").trim(), amount: round2(toNumber(row.amount)), notes: String(row.notes || "").trim() }))
      .filter((row) => row.category && row.amount > 0);
    data.expenseTotal = round2(data.expenses.reduce((total, row) => total + row.amount, 0));
    return data;
  },
  afterSave: async (req, doc, old) => {
    await syncTripExpenses(req.userId, doc);
    await refreshVehicleKm(req.userId, doc.vehicleId);
    if (old && idOf(old.vehicleId) !== idOf(doc.vehicleId)) await refreshVehicleKm(req.userId, old.vehicleId);
  },
  afterDelete: async (req, doc) => {
    await Expense.deleteMany({ userId: req.userId, tripId: doc._id });
    // Diesel filled for this trip stays, now without a trip
    await DieselEntry.updateMany({ userId: req.userId, tripId: doc._id }, { $set: { tripId: null } });
    await refreshVehicleKm(req.userId, doc.vehicleId);
  },
};

module.exports = { crudOptions };
