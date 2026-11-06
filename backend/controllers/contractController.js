const { Contract } = require("../models");
const { contractAmount, contractSegments, monthRange, dayNum, todayNum } = require("../utils/common");
const { refuse, ownVehicle } = require("../utils/guards");

// Monthly hire: vehicles hired in / given out on monthly rent
const contractStatus = (contract) => {
  const today = todayNum();
  if (dayNum(contract.startDate) > today) return "upcoming";
  if (contract.endDate && dayNum(contract.endDate) < today) return "ended";
  return "running";
};

// GET /contracts: each contract with its status, this month's rent and the rent run up till today
const list = async (req, res) => {
  const query = { userId: req.userId };
  ["direction", "vehicleId", "partyId"].forEach((field) => {
    if (req.query[field]) query[field] = req.query[field];
  });
  const { from, to } = monthRange(req.query.month);
  const contracts = await Contract.find(query).sort({ startDate: -1 }).populate("vehicleId partyId").lean();
  res.json(contracts.map((contract) => ({
    ...contract,
    status: contractStatus(contract),
    monthAmount: contractAmount(contract, from, to),
    accruedTillToday: contractAmount(contract, null, new Date()),
    months: contractSegments(contract, null, new Date()),
  })));
};

const crudOptions = {
  populate: "vehicleId partyId",
  number: { field: "contractNo", key: "contract", prefix: "MH" },
  prepare: async (req, data) => {
    const vehicle = await ownVehicle(req, data.vehicleId);
    if (!vehicle) throw refuse("Pick a vehicle");
    if (!data.partyId) throw refuse("Pick the party");
    if (data.endDate && data.startDate && new Date(data.endDate) < new Date(data.startDate)) {
      throw refuse("End date cannot be before the start date");
    }
    // A vehicle hired in comes from its owner
    if (data.direction === "hire_in" && vehicle.ownership === "own") {
      throw refuse("This is your own vehicle. Use 'Given Out' to rent it to a party.");
    }
    return data;
  },
};

module.exports = { list, crudOptions };
