const { Trip, Contract, Expense, MeterReading, Maintenance, Document, Employee } = require("../models");
const { toNumber, routeKey } = require("../utils/common");
const { refuse, usedBy } = require("../utils/guards");

// My own vehicles and hired ones, with the agreed rate for each route they run
const crudOptions = {
  sort: { vehicleNo: 1 },
  populate: "ownerPartyId",
  filters: ["status", "ownership", "category"],
  searchFields: ["vehicleNo", "driverName", "make", "model"],
  prepare: async (req, data) => {
    if (data.ownership === "own") {
      data.ownerPartyId = null;
      data.hireBasis = "";
      data.hireRate = 0;
    }
    if (data.expectedMileage !== undefined) data.expectedMileage = Math.max(0, toNumber(data.expectedMileage));
    if (data.ownership === "hired" && !data.ownerPartyId) throw refuse("Pick the party the vehicle is hired from");
    if (data.routeRates !== undefined) {
      data.routeRates = (Array.isArray(data.routeRates) ? data.routeRates : [])
        .map((row) => ({
          from: String(row.from || "").trim(),
          to: String(row.to || "").trim(),
          basis: ["per_trip", "per_km", "per_ton"].includes(row.basis) ? row.basis : "per_trip",
          rate: toNumber(row.rate),
          hireRate: data.ownership === "hired" ? toNumber(row.hireRate) : 0,
          distanceKm: toNumber(row.distanceKm),
        }))
        .filter((row) => row.from || row.to);
      if (data.routeRates.some((row) => !row.from || !row.to)) throw refuse("Each route needs both From and To");
      const keys = data.routeRates.map(routeKey);
      if (new Set(keys).size !== keys.length) throw refuse("A route is added twice");
    }
    return data;
  },
  beforeDelete: (req, doc) => usedBy([
    [Trip, { userId: req.userId, vehicleId: doc._id }, "trips"],
    [Contract, { userId: req.userId, vehicleId: doc._id }, "monthly hire"],
    [Expense, { userId: req.userId, vehicleId: doc._id }, "expenses"],
  ]),
  afterDelete: async (req, doc) => {
    await Promise.all([
      MeterReading.deleteMany({ userId: req.userId, vehicleId: doc._id }),
      Maintenance.deleteMany({ userId: req.userId, vehicleId: doc._id }),
      Document.deleteMany({ userId: req.userId, vehicleId: doc._id }),
      Employee.updateMany({ userId: req.userId, vehicleId: doc._id }, { $set: { vehicleId: null } }),
    ]);
  },
};

module.exports = { crudOptions };
