const { Trip, Contract, Payment, Vehicle, Purchase, DieselEntry } = require("../models");
const { usedBy } = require("../utils/guards");

// Customers (I bill them) and suppliers (I pay them: vehicle owners, petrol pumps, tyres, parts)
const crudOptions = {
  sort: { name: 1 },
  filters: ["type"],
  searchFields: ["name", "mobile", "address"],
  prepare: async (req, data) => {
    if (data.type !== undefined && data.type !== "customer") data.type = "supplier";
    return data;
  },
  beforeDelete: (req, doc) => usedBy([
    [Trip, { userId: req.userId, $or: [{ partyId: doc._id }, { hirePartyId: doc._id }] }, "trips"],
    [Contract, { userId: req.userId, partyId: doc._id }, "monthly hire"],
    [Payment, { userId: req.userId, partyId: doc._id }, "payments"],
    [Vehicle, { userId: req.userId, ownerPartyId: doc._id }, "vehicles"],
    [Purchase, { userId: req.userId, partyId: doc._id }, "purchases"],
    [DieselEntry, { userId: req.userId, partyId: doc._id }, "diesel purchases"],
  ]),
};

module.exports = { crudOptions };
