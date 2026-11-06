const { toNumber, idOf } = require("../utils/common");
const { refuse, ownVehicle } = require("../utils/guards");
const { refreshVehicleKm } = require("../utils/stock");

const meterValue = (value) => (value === "" || value === null || value === undefined ? null : toNumber(value, NaN));

// Opening and closing meter of a vehicle's run; the closing can be filled in later
const crudOptions = {
  sort: { date: -1, reading: -1 },
  populate: "vehicleId",
  dateField: "date",
  filters: ["vehicleId"],
  prepare: async (req, data) => {
    if (!(await ownVehicle(req, data.vehicleId))) throw refuse("Pick a vehicle");
    const opening = meterValue(data.openingReading);
    const closing = meterValue(data.closingReading);
    if (opening === null || !(opening >= 0)) throw refuse("Enter the opening reading");
    if (closing !== null && !(closing >= 0)) throw refuse("Closing reading must be a number");
    if (closing !== null && closing < opening) throw refuse("Closing reading cannot be less than the opening reading");
    data.openingReading = opening;
    data.closingReading = closing;
    delete data.reading;
    return data;
  },
  afterSave: async (req, doc, old) => {
    await refreshVehicleKm(req.userId, doc.vehicleId);
    if (old && idOf(old.vehicleId) !== idOf(doc.vehicleId)) await refreshVehicleKm(req.userId, old.vehicleId);
  },
  afterDelete: (req, doc) => refreshVehicleKm(req.userId, doc.vehicleId),
};

module.exports = { crudOptions };
