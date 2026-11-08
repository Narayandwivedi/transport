const { Vehicle, Trip, Contract } = require("../models");
const { monthRange, round2, toNumber } = require("../utils/common");
const reports = require("../utils/reports");
const { mileageReport } = require("../utils/mileage");
const business = require("../utils/businessReports");

// ?from=&to= days, or ?month=YYYY-MM (this month when neither is given)
const periodFrom = (query) => {
  if (query.from && query.to) return { from: new Date(query.from), to: new Date(query.to) };
  return monthRange(query.month);
};

const profit = async (req, res) => {
  const { from, to } = periodFrom(req.query);
  res.json(await reports.profitReport(req.userId, from, to));
};

const trend = async (req, res) => {
  res.json(await reports.monthlyTrend(req.userId, Math.min(24, toNumber(req.query.months, 6) || 6)));
};

const balances = async (req, res) => {
  res.json(await reports.partyBalances(req.userId));
};

const partyLedger = async (req, res) => {
  const ledger = await reports.partyLedger(req.userId, req.params.id);
  if (!ledger) return res.status(404).json({ message: "Party not found" });
  res.json(ledger);
};

// ?months=3|6|12|0 (0 = all time) &vehicleId=
const mileage = async (req, res) => {
  const months = [0, 1, 3, 6, 12].includes(toNumber(req.query.months, 3)) ? toNumber(req.query.months, 3) : 3;
  res.json(await mileageReport(req.userId, { months, vehicleId: req.query.vehicleId || "" }));
};

// Reports page: ?from=&to= days or ?month=YYYY-MM
const dieselReport = async (req, res) => {
  const { from, to } = periodFrom(req.query);
  res.json(await business.dieselReport(req.userId, from, to));
};
const tripReport = async (req, res) => {
  const { from, to } = periodFrom(req.query);
  res.json(await business.tripReport(req.userId, from, to));
};
const expenseReport = async (req, res) => {
  const { from, to } = periodFrom(req.query);
  res.json(await business.expenseReport(req.userId, from, to));
};

const alerts = async (req, res) => {
  res.json(await reports.alerts(req.userId));
};

// Everything the dashboard shows, in one call
const dashboard = async (req, res) => {
  const { from, to } = monthRange();
  const [profitReport, monthlyTrend, alertList, partyBalances, vehicles, recentTrips] = await Promise.all([
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
    profit: profitReport,
    trend: monthlyTrend,
    alerts: alertList,
    recentTrips,
    receivable: round2(partyBalances.filter((row) => row.balance > 0).reduce((total, row) => total + row.balance, 0)),
    payable: round2(partyBalances.filter((row) => row.balance < 0).reduce((total, row) => total - row.balance, 0)),
    vehicles: {
      total: vehicles.filter((vehicle) => vehicle.status !== "sold").length,
      own: vehicles.filter((vehicle) => vehicle.ownership === "own" && vehicle.status !== "sold").length,
      hired: vehicles.filter((vehicle) => vehicle.ownership === "hired" && vehicle.status !== "sold").length,
    },
    hiredIn: runningContracts.filter((contract) => contract.direction === "hire_in").length,
    givenOut: runningContracts.filter((contract) => contract.direction === "give_out").length,
  });
};

module.exports = { profit, trend, balances, partyLedger, mileage, dieselReport, tripReport, expenseReport, alerts, dashboard };
