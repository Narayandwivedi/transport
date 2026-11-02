const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  Party, Vehicle, Trip, Contract, Payment, Expense, InventoryItem, InventoryTxn, MeterReading, Maintenance, Document, Quotation, Employee,
} = require("../models");
const crudRouter = require("../utils/crud");
const upload = require("../config/upload");
const { contractAmount, contractSegments, monthRange, round2, toNumber, dayNum, todayNum, idOf } = require("../utils/common");
const { refreshVehicleKm, refreshItem } = require("../utils/stock");
const reports = require("../utils/reports");
const payrollRoutes = require("./payrollRoutes");

const router = express.Router();

const refuse = (message) => Object.assign(new Error(message), { status: 400 });

// Quantity × rate, the rate itself for a fixed amount, or tons × km × rate per ton per km
const lineAmount = (basis, quantity, rate, km = 0) => {
  if (basis === "fixed") return round2(toNumber(rate));
  if (basis === "per_ton_km") return round2(toNumber(quantity) * toNumber(km) * toNumber(rate));
  return round2(toNumber(quantity) * toNumber(rate));
};

// "raipur|bilaspur": a route matched without caring about capitals or spaces
const routeKey = (row) => `${String(row.from || "").trim().toLowerCase()}|${String(row.to || "").trim().toLowerCase()}`;

const ownVehicle = async (req, vehicleId) => {
  const vehicle = vehicleId ? await Vehicle.findOne({ _id: vehicleId, userId: req.userId }).lean() : null;
  if (vehicleId && !vehicle) throw refuse("Vehicle not found");
  return vehicle;
};

const usedBy = async (checks) => {
  for (const [Model, filter, label] of checks) {
    if (await Model.exists(filter)) return `Cannot delete: it is used in ${label}. Delete those first.`;
  }
  return "";
};

/* ───────── Parties ───────── */
router.use("/parties", crudRouter(Party, {
  sort: { name: 1 },
  filters: ["type"],
  searchFields: ["name", "mobile", "address"],
  beforeDelete: (req, doc) => usedBy([
    [Trip, { userId: req.userId, $or: [{ partyId: doc._id }, { hirePartyId: doc._id }] }, "trips"],
    [Contract, { userId: req.userId, partyId: doc._id }, "monthly hire"],
    [Payment, { userId: req.userId, partyId: doc._id }, "payments"],
    [Vehicle, { userId: req.userId, ownerPartyId: doc._id }, "vehicles"],
  ]),
}));

/* ───────── Vehicles ───────── */
router.use("/vehicles", crudRouter(Vehicle, {
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
}));

/* ───────── Trips ───────── */
router.use("/trips", crudRouter(Trip, {
  sort: { date: -1, createdAt: -1 },
  populate: "vehicleId partyId hirePartyId",
  dateField: "date",
  filters: ["vehicleId", "partyId", "status", "hirePartyId"],
  searchFields: ["tripNo", "from", "to", "material", "notes"],
  number: { field: "tripNo", key: "trip", prefix: "TR" },
  prepare: async (req, data) => {
    const vehicle = await ownVehicle(req, data.vehicleId);
    if (!vehicle) throw refuse("Pick a vehicle");
    if (!data.partyId) throw refuse("Pick the party to bill");
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
    data.amount = lineAmount(data.billingBasis, data.quantity, data.rate, data.distanceKm);
    // Only a hired vehicle paid per trip / km / ton costs hire on the trip
    if (vehicle.ownership === "hired" && data.hireBasis) {
      data.hirePartyId = data.hirePartyId || vehicle.ownerPartyId;
      data.hireAmount = lineAmount(data.hireBasis, data.hireQuantity, data.hireRate, data.distanceKm);
    } else {
      Object.assign(data, { hireBasis: "", hireQuantity: 0, hireRate: 0, hireAmount: 0, hirePartyId: null });
    }
    return data;
  },
  afterSave: async (req, doc, old) => {
    await refreshVehicleKm(req.userId, doc.vehicleId);
    if (old && idOf(old.vehicleId) !== idOf(doc.vehicleId)) await refreshVehicleKm(req.userId, old.vehicleId);
  },
  afterDelete: (req, doc) => refreshVehicleKm(req.userId, doc.vehicleId),
}));

/* ───────── Monthly hire (vehicles hired in / given out on monthly rent) ───────── */
const contractStatus = (contract) => {
  const today = todayNum();
  if (dayNum(contract.startDate) > today) return "upcoming";
  if (contract.endDate && dayNum(contract.endDate) < today) return "ended";
  return "running";
};

router.get("/contracts", async (req, res) => {
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
});

router.use("/contracts", crudRouter(Contract, {
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
}));

/* ───────── Payments ───────── */
router.use("/payments", crudRouter(Payment, {
  sort: { date: -1, createdAt: -1 },
  populate: "partyId",
  dateField: "date",
  filters: ["partyId", "type", "mode"],
  searchFields: ["reference", "notes"],
}));

/* ───────── Expenses ───────── */
router.use("/expenses", crudRouter(Expense, {
  sort: { date: -1, createdAt: -1 },
  populate: "vehicleId",
  dateField: "date",
  filters: ["vehicleId", "category", "source"],
  searchFields: ["category", "paidTo", "notes"],
  prepare: async (req, data) => {
    await ownVehicle(req, data.vehicleId);
    data.source = "manual";
    data.inventoryTxnId = null;
    return data;
  },
  canChange: (doc) => ({
    inventory: "This expense came from issuing store stock. Change or delete it in Inventory.",
    payroll: "This expense is a salary / advance / bata payment. Change or delete it in Payroll.",
  })[doc.source] || "",
  afterSave: (req, doc) => refreshVehicleKm(req.userId, doc.vehicleId),
  afterDelete: (req, doc) => refreshVehicleKm(req.userId, doc.vehicleId),
}));

router.get("/expense-categories", async (req, res) => {
  const used = await Expense.distinct("category", { userId: req.userId });
  const defaults = [
    "Diesel", "Tyre", "Repair & Maintenance", "Spare Parts", "Oil & Lubricants", "Driver Salary", "Driver Bata",
    "Staff Salary", "Toll", "Loading / Unloading", "Insurance", "Road Tax", "Permit", "Fitness", "PUC", "GPS", "EMI",
    "Fine / Challan", "Parking", "Washing", "Office", "Other",
  ];
  res.json([...new Set([...defaults, ...used])]);
});

/* ───────── Inventory: tyres, diesel, oil, spares ───────── */
router.use("/inventory/items", crudRouter(InventoryItem, {
  sort: { name: 1 },
  filters: ["category"],
  searchFields: ["name"],
  prepare: async (req, data) => {
    // Stock and rate come from purchases and issues only
    delete data.stockQty;
    delete data.avgRate;
    return data;
  },
  beforeDelete: (req, doc) => usedBy([[InventoryTxn, { userId: req.userId, itemId: doc._id }, "purchases / issues"]]),
}));

router.use("/inventory/txns", crudRouter(InventoryTxn, {
  sort: { date: -1, createdAt: -1 },
  populate: "itemId vehicleId partyId",
  dateField: "date",
  filters: ["itemId", "type", "vehicleId", "partyId"],
  prepare: async (req, data) => {
    const item = await InventoryItem.findOne({ _id: data.itemId, userId: req.userId }).lean();
    if (!item) throw refuse("Pick an item");
    if (!(toNumber(data.quantity) > 0)) throw refuse("Enter the quantity");
    if (data.type === "issue") {
      await ownVehicle(req, data.vehicleId);
      data.partyId = null;
    } else {
      data.vehicleId = null;
      data.odometer = 0;
      data.amount = round2(toNumber(data.quantity) * toNumber(data.rate));
    }
    return data;
  },
  afterSave: async (req, doc, old) => {
    await refreshItem(req.userId, doc.itemId);
    if (old && idOf(old.itemId) !== idOf(doc.itemId)) await refreshItem(req.userId, old.itemId);
    // An issue changed to a purchase no longer costs a vehicle anything
    if (doc.type !== "issue") await Expense.deleteMany({ userId: req.userId, inventoryTxnId: doc._id });
    await refreshVehicleKm(req.userId, doc.vehicleId);
    if (old?.vehicleId && idOf(old.vehicleId) !== idOf(doc.vehicleId)) await refreshVehicleKm(req.userId, old.vehicleId);
  },
  afterDelete: async (req, doc) => {
    await Expense.deleteMany({ userId: req.userId, inventoryTxnId: doc._id });
    await refreshItem(req.userId, doc.itemId);
    await refreshVehicleKm(req.userId, doc.vehicleId);
  },
}));

/* ───────── Meter readings ───────── */
const meterValue = (value) => (value === "" || value === null || value === undefined ? null : toNumber(value, NaN));

router.use("/meter-readings", crudRouter(MeterReading, {
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
}));

/* ───────── Maintenance schedules ───────── */
router.get("/maintenance", async (req, res) => {
  const tasks = await reports.maintenanceStatus(req.userId);
  res.json(req.query.vehicleId ? tasks.filter((task) => idOf(task.vehicleId) === req.query.vehicleId) : tasks);
});

// Service done today: restart the count from this km / date, and book its cost against the vehicle
router.post("/maintenance/:id/done", async (req, res) => {
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
});

router.use("/maintenance", crudRouter(Maintenance, {
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
}));

/* ───────── Vehicle documents: tax, insurance, fitness, PUC, GPS, permit… ───────── */
const removeUpload = async (file) => {
  if (!file) return;
  await fs.promises.unlink(path.join(__dirname, "..", file)).catch(() => {});
};

router.get("/documents", async (req, res) => {
  let docs = await reports.documentStatus(req.userId);
  if (req.query.vehicleId) docs = docs.filter((doc) => idOf(doc.vehicleId) === req.query.vehicleId);
  if (req.query.docType) docs = docs.filter((doc) => doc.docType === req.query.docType);
  res.json(docs);
});

router.use("/documents", upload.single("file"), crudRouter(Document, {
  populate: "vehicleId",
  prepare: async (req, data, old) => {
    if (!(await ownVehicle(req, data.vehicleId))) throw refuse("Pick a vehicle");
    delete data.file;
    delete data.fileName;
    if (req.file) {
      data.file = `/uploads/${req.file.filename}`;
      data.fileName = req.file.originalname;
      if (old?.file) await removeUpload(old.file);
    } else if (req.body.removeFile === "true" && old?.file) {
      await removeUpload(old.file);
      data.file = "";
      data.fileName = "";
    }
    return data;
  },
  afterDelete: async (req, doc) => removeUpload(doc.file),
}));

/* ───────── Quotations ───────── */
router.use("/quotations", crudRouter(Quotation, {
  sort: { date: -1, createdAt: -1 },
  populate: "partyId",
  dateField: "date",
  filters: ["partyId", "status"],
  searchFields: ["quoteNo", "customerName", "subject"],
  number: { field: "quoteNo", key: "quotation", prefix: "QT" },
  prepare: async (req, data) => {
    data.items = (Array.isArray(data.items) ? data.items : [])
      .filter((item) => item.description || item.from || item.to || toNumber(item.rate))
      .map((item) => ({ ...item, amount: lineAmount(item.basis, item.quantity, item.rate) }));
    if (!data.items.length) throw refuse("Add at least one line");
    if (!data.partyId && !data.customerName) throw refuse("Pick a party or type the customer name");
    return data;
  },
}));

/* ───────── Payroll: drivers and staff ───────── */
router.use("/payroll", payrollRoutes);

/* ───────── Reports & alerts ───────── */
const periodFrom = (query) => {
  if (query.from && query.to) return { from: new Date(query.from), to: new Date(query.to) };
  return monthRange(query.month);
};

router.get("/reports/profit", async (req, res) => {
  const { from, to } = periodFrom(req.query);
  res.json(await reports.profitReport(req.userId, from, to));
});

router.get("/reports/trend", async (req, res) => {
  res.json(await reports.monthlyTrend(req.userId, Math.min(24, toNumber(req.query.months, 6) || 6)));
});

router.get("/reports/balances", async (req, res) => {
  res.json(await reports.partyBalances(req.userId));
});

router.get("/reports/party-ledger/:id", async (req, res) => {
  const ledger = await reports.partyLedger(req.userId, req.params.id);
  if (!ledger) return res.status(404).json({ message: "Party not found" });
  res.json(ledger);
});

router.get("/alerts", async (req, res) => {
  res.json(await reports.alerts(req.userId));
});

router.get("/dashboard", async (req, res) => {
  const { from, to } = monthRange();
  const [profit, trend, alertList, balances, vehicles, recentTrips] = await Promise.all([
    reports.profitReport(req.userId, from, to),
    reports.monthlyTrend(req.userId, 6),
    reports.alerts(req.userId),
    reports.partyBalances(req.userId),
    Vehicle.find({ userId: req.userId }).select("ownership status").lean(),
    Trip.find({ userId: req.userId }).sort({ date: -1, createdAt: -1 }).limit(6).populate("vehicleId partyId", "vehicleNo name").lean(),
  ]);
  const runningContracts = await Contract.find({
    userId: req.userId,
    startDate: { $lte: new Date() },
    $or: [{ endDate: null }, { endDate: { $gte: new Date(new Date().toISOString().slice(0, 10)) } }],
  }).select("direction").lean();
  res.json({
    profit,
    trend,
    alerts: alertList,
    recentTrips,
    receivable: round2(balances.filter((row) => row.balance > 0).reduce((total, row) => total + row.balance, 0)),
    payable: round2(balances.filter((row) => row.balance < 0).reduce((total, row) => total - row.balance, 0)),
    vehicles: {
      total: vehicles.filter((vehicle) => vehicle.status !== "sold").length,
      own: vehicles.filter((vehicle) => vehicle.ownership === "own" && vehicle.status !== "sold").length,
      hired: vehicles.filter((vehicle) => vehicle.ownership === "hired" && vehicle.status !== "sold").length,
    },
    hiredIn: runningContracts.filter((contract) => contract.direction === "hire_in").length,
    givenOut: runningContracts.filter((contract) => contract.direction === "give_out").length,
  });
});

module.exports = router;
