const { DieselEntry, Trip, Expense } = require("../models");
const { round2, toNumber } = require("./common");

/**
 * Business reports for the Reports page: diesel by vehicle and pump, trips by vehicle and party,
 * expenses by type and vehicle. Each takes a period of whole days { from, to } (UTC, like the rest of the app).
 */

const inPeriod = (from, to) => ({ date: { $gte: from, $lte: to } });

// Adds a value to the group with this key, making the group the first time
const groupInto = (map, key, make) => {
  if (!map.has(key)) map.set(key, make());
  return map.get(key);
};
const sortedBy = (map, field) => [...map.values()].sort((a, b) => b[field] - a[field]);

// What was paid at the pump; entries saved before paidAmount existed count as paid in full
const dieselPaid = (fill) => (fill.paidAmount === null || fill.paidAmount === undefined ? toNumber(fill.amount) : toNumber(fill.paidAmount));

const dieselReport = async (userId, from, to) => {
  const fills = await DieselEntry.find({ userId, ...inPeriod(from, to) })
    .sort({ date: -1, createdAt: -1 })
    .populate("vehicleId", "vehicleNo")
    .populate("partyId", "name")
    .populate("tripId", "tripNo")
    .lean();

  const vehicles = new Map();
  const pumps = new Map();
  const blank = () => ({ fills: 0, litres: 0, amount: 0, paid: 0 });
  const add = (row, fill) => {
    row.fills += 1;
    row.litres += toNumber(fill.litres);
    row.amount += toNumber(fill.amount);
    row.paid += dieselPaid(fill);
  };
  const totals = blank();

  fills.forEach((fill) => {
    const vehicleId = String(fill.vehicleId?._id || fill.vehicleId || "");
    add(groupInto(vehicles, vehicleId, () => ({ vehicleId, vehicleNo: fill.vehicleId?.vehicleNo || "—", ...blank() })), fill);
    const partyId = String(fill.partyId?._id || "");
    add(groupInto(pumps, partyId, () => ({ partyId, name: fill.partyId?.name || "Cash (no pump)", ...blank() })), fill);
    add(totals, fill);
  });

  const finish = (row) => ({
    ...row,
    litres: round2(row.litres),
    amount: round2(row.amount),
    paid: round2(row.paid),
    due: round2(Math.max(0, row.amount - row.paid)),
    avgRate: row.litres ? round2(row.amount / row.litres) : 0,
  });

  return {
    from,
    to,
    totals: finish(totals),
    byVehicle: sortedBy(vehicles, "litres").map(finish),
    byPump: sortedBy(pumps, "amount").map(finish),
    entries: fills.map((fill) => ({
      id: String(fill._id),
      date: fill.date,
      entryNo: fill.entryNo,
      vehicleId: String(fill.vehicleId?._id || fill.vehicleId || ""),
      vehicleNo: fill.vehicleId?.vehicleNo || "—",
      pump: fill.partyId?.name || "Cash",
      tripNo: fill.tripId?.tripNo || "",
      litres: toNumber(fill.litres),
      rate: toNumber(fill.rate),
      amount: toNumber(fill.amount),
      paid: dieselPaid(fill),
      meterReading: toNumber(fill.meterReading),
      billNo: fill.billNo || "",
    })),
  };
};

const tripReport = async (userId, from, to) => {
  const trips = await Trip.find({ userId, ...inPeriod(from, to) })
    .populate("vehicleId", "vehicleNo")
    .populate("partyId", "name")
    .lean();

  const vehicles = new Map();
  const parties = new Map();
  const blank = () => ({ trips: 0, billing: 0, received: 0, hire: 0, materialSold: 0, materialCost: 0 });
  const add = (row, trip) => {
    row.trips += 1;
    row.billing += toNumber(trip.amount);
    row.received += toNumber(trip.receivedAmount);
    row.hire += toNumber(trip.hireAmount);
    // Material I supplied: sold inside the bill, bought at materialCost
    if (trip.materialBy === "me") {
      row.materialSold += toNumber(trip.materialAmount);
      row.materialCost += toNumber(trip.materialCost);
    }
  };
  const totals = blank();

  trips.forEach((trip) => {
    const vehicleId = String(trip.vehicleId?._id || trip.vehicleId || "");
    add(groupInto(vehicles, vehicleId, () => ({ vehicleId, vehicleNo: trip.vehicleId?.vehicleNo || "—", ...blank() })), trip);
    const partyId = String(trip.partyId?._id || trip.partyId || "");
    add(groupInto(parties, partyId, () => ({ partyId, name: trip.partyId?.name || "—", ...blank() })), trip);
    add(totals, trip);
  });

  // "Due" here is what is still unpaid on the trips themselves; payments made later show in the party ledger
  const finish = (row) => ({
    ...row,
    billing: round2(row.billing),
    received: round2(row.received),
    hire: round2(row.hire),
    materialSold: round2(row.materialSold),
    materialCost: round2(row.materialCost),
    materialProfit: round2(row.materialSold - row.materialCost),
    due: round2(Math.max(0, row.billing - row.received)),
  });

  return { from, to, totals: finish(totals), byVehicle: sortedBy(vehicles, "billing").map(finish), byParty: sortedBy(parties, "billing").map(finish) };
};

const SOURCE_TEXT = { manual: "Entered", inventory: "Stock issue", maintenance: "Maintenance", payroll: "Payroll", trip: "Trip spend", diesel: "Diesel" };

const expenseReport = async (userId, from, to) => {
  const expenses = await Expense.find({ userId, ...inPeriod(from, to) }).populate("vehicleId", "vehicleNo").lean();

  const categories = new Map();
  const vehicles = new Map();
  const blank = () => ({ count: 0, amount: 0 });
  const add = (row, expense) => {
    row.count += 1;
    row.amount += toNumber(expense.amount);
  };
  const totals = blank();

  expenses.forEach((expense) => {
    const category = expense.category || "Other";
    add(groupInto(categories, category, () => ({ category, sources: new Set(), ...blank() })), expense);
    categories.get(category).sources.add(SOURCE_TEXT[expense.source] || "Entered");
    const vehicleId = String(expense.vehicleId?._id || expense.vehicleId || "");
    add(groupInto(vehicles, vehicleId, () => ({ vehicleId, vehicleNo: expense.vehicleId?.vehicleNo || "General / Office", ...blank() })), expense);
    add(totals, expense);
  });

  return {
    from,
    to,
    totals: { ...totals, amount: round2(totals.amount) },
    byCategory: sortedBy(categories, "amount").map(({ sources, ...row }) => ({ ...row, amount: round2(row.amount), from: [...sources].join(", ") })),
    byVehicle: sortedBy(vehicles, "amount").map((row) => ({ ...row, amount: round2(row.amount) })),
  };
};

/**
 * Tyre punctures. Read from each trip's own expenses (so every trip counts, even one saved before trip
 * expenses were copied to the Expenses list), plus punctures entered on their own in Expenses.
 * Expense records made from a trip are skipped there, so nothing is counted twice.
 */
const PUNCTURE = /^tyre\s*puncture$/i;

const punctureReport = async (userId, from, to, vehicleId = null) => {
  const ofVehicle = vehicleId ? { vehicleId } : {};
  const [trips, expenses] = await Promise.all([
    // A trip in the period, or one with a puncture dated in it; each puncture is then kept by its own date
    Trip.find({ userId, ...ofVehicle, "expenses.category": PUNCTURE, $or: [inPeriod(from, to), { "expenses.date": { $gte: from, $lte: to } }] })
      .select("tripNo date from to vehicleId expenses createdAt")
      .populate("vehicleId", "vehicleNo")
      .lean(),
    Expense.find({ userId, ...ofVehicle, category: PUNCTURE, source: { $ne: "trip" }, ...inPeriod(from, to) })
      .populate("vehicleId", "vehicleNo")
      .lean(),
  ]);

  const vehicleOf = (doc) => ({ vehicleId: String(doc.vehicleId?._id || doc.vehicleId || ""), vehicleNo: doc.vehicleId?.vehicleNo || "No vehicle" });
  const fromTrips = trips.flatMap((trip) => (trip.expenses || [])
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const when = new Date(row.date || trip.date);
      return PUNCTURE.test(row.category || "") && toNumber(row.amount) > 0 && when >= from && when <= to;
    })
    .map(({ row, index }) => ({
      id: `${trip._id}-${index}`,
      // The puncture's own date when saved, else the trip's
      date: row.date || trip.date,
      createdAt: trip.createdAt,
      ...vehicleOf(trip),
      amount: round2(toNumber(row.amount)),
      notes: row.notes || "",
      trip: { id: String(trip._id), tripNo: trip.tripNo, route: [trip.from, trip.to].filter(Boolean).join(" → ") },
    })));
  const onTheirOwn = expenses.filter((expense) => toNumber(expense.amount) > 0).map((expense) => ({
    id: String(expense._id),
    date: expense.date,
    createdAt: expense.createdAt,
    ...vehicleOf(expense),
    amount: round2(toNumber(expense.amount)),
    notes: expense.notes || "",
    trip: null,
  }));
  // Latest puncture first
  const entries = [...fromTrips, ...onTheirOwn]
    .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(({ createdAt, ...row }) => row);

  const vehicles = new Map();
  const totals = { count: 0, amount: 0 };
  entries.forEach((entry) => {
    const row = groupInto(vehicles, entry.vehicleId, () => ({ vehicleId: entry.vehicleId, vehicleNo: entry.vehicleNo, count: 0, amount: 0 }));
    row.count += 1;
    row.amount += entry.amount;
    totals.count += 1;
    totals.amount += entry.amount;
  });

  return {
    from,
    to,
    totals: { ...totals, amount: round2(totals.amount), onTrips: entries.filter((row) => row.trip).length },
    byVehicle: sortedBy(vehicles, "amount").map((row) => ({ ...row, amount: round2(row.amount) })),
    entries,
  };
};

module.exports = { dieselReport, tripReport, expenseReport, punctureReport };
