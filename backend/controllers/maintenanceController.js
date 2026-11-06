const { Maintenance, Expense } = require("../models");
const { toNumber, idOf } = require("../utils/common");
const { refuse, ownVehicle } = require("../utils/guards");
const { refreshVehicleKm } = require("../utils/stock");
const reports = require("../utils/reports");

// GET /maintenance: every schedule with what is left before it falls due
const list = async (req, res) => {
  const tasks = await reports.maintenanceStatus(req.userId);
  res.json(req.query.vehicleId ? tasks.filter((task) => idOf(task.vehicleId) === req.query.vehicleId) : tasks);
};

// POST /maintenance/:id/done: restart the count from this km / date, and book its cost against the vehicle
const markDone = async (req, res) => {
  const task = await Maintenance.findOne({ _id: req.params.id, userId: req.userId });
  if (!task) return res.status(404).json({ message: "Not found" });
  const date = req.body.date ? new Date(req.body.date) : new Date();
  const km = toNumber(req.body.km);
  const cost = toNumber(req.body.cost);
  task.lastDoneDate = date;
  if (km) task.lastDoneKm = km;
  task.history.push({ date, km, cost, notes: req.body.notes || "" });
  await task.save();
  if (cost > 0) {
    await Expense.create({
      userId: req.userId,
      date,
      vehicleId: task.vehicleId,
      category: "Repair & Maintenance",
      amount: cost,
      odometer: km,
      paidTo: req.body.paidTo || "",
      notes: `${task.title}${req.body.notes ? ` · ${req.body.notes}` : ""}`,
      source: "maintenance",
    });
  }
  await refreshVehicleKm(req.userId, task.vehicleId);
  res.json({ success: true });
};

// Service due every N km and/or every N days
const crudOptions = {
  populate: "vehicleId",
  filters: ["vehicleId"],
  prepare: async (req, data) => {
    if (!(await ownVehicle(req, data.vehicleId))) throw refuse("Pick a vehicle");
    if (!(toNumber(data.intervalKm) > 0) && !(toNumber(data.intervalDays) > 0)) {
      throw refuse("Set the km or the days after which it is due");
    }
    delete data.history;
    return data;
  },
  afterSave: (req, doc) => refreshVehicleKm(req.userId, doc.vehicleId),
};

module.exports = { list, markDone, crudOptions };
