const { Vehicle } = require("../models");

// A wrong input: answered with status 400 and this message
const refuse = (message) => Object.assign(new Error(message), { status: 400 });

// The vehicle, when it belongs to this account (null when none was picked)
const ownVehicle = async (req, vehicleId) => {
  const vehicle = vehicleId ? await Vehicle.findOne({ _id: vehicleId, userId: req.userId }).lean() : null;
  if (vehicleId && !vehicle) throw refuse("Vehicle not found");
  return vehicle;
};

// checks: [[Model, filter, label]]; a message naming the first one still in use, or ""
const usedBy = async (checks) => {
  for (const [Model, filter, label] of checks) {
    if (await Model.exists(filter)) return `Cannot delete: it is used in ${label}. Delete those first.`;
  }
  return "";
};

module.exports = { refuse, ownVehicle, usedBy };
