const {
  User, Party, Vehicle, Trip, Contract, Payment, Expense, InventoryItem, InventoryTxn, Maintenance, Document, Employee,
} = require("../models");
const { contractAmount, contractSegments, dayNum, todayNum, round2, toNumber, idOf, DAY_MS } = require("./common");

const inRange = (field, from, to) => ({ [field]: { $gte: new Date(from), $lte: new Date(to) } });

// Contracts that overlap a period
const contractsOverlapping = (userId, from, to) => Contract.find({
  userId,
  startDate: { $lte: new Date(to) },
  $or: [{ endDate: null }, { endDate: { $gte: new Date(from) } }],
}).lean();

const emptyRow = () => ({
  trips: 0,
  tripIncome: 0,
  rentIncome: 0,
  tripHireCost: 0,
  rentCost: 0,
  expenses: 0,
  km: 0,
});

const finishRow = (row) => {
  const income = round2(row.tripIncome + row.rentIncome);
  const cost = round2(row.tripHireCost + row.rentCost + row.expenses);
  return { ...row, income, cost, profit: round2(income - cost) };
};

/**
 * Profit between two days, vehicle by vehicle.
 * Income: trips billed + monthly rent charged on vehicles given out.
 * Cost: hire paid on trips of hired vehicles + monthly rent paid on vehicles hired in + every expense of the vehicle
 * (diesel, tyres from the store, repairs, documents…). Expenses with no vehicle count only in the business total.
 */
const profitReport = async (userId, from, to) => {
  const [vehicles, trips, contracts, expenses] = await Promise.all([
    Vehicle.find({ userId }).populate("ownerPartyId", "name").lean(),
    Trip.find({ userId, ...inRange("date", from, to) }).lean(),
    contractsOverlapping(userId, from, to),
    Expense.find({ userId, ...inRange("date", from, to) }).lean(),
  ]);

  const rows = new Map(vehicles.map((vehicle) => [String(vehicle._id), emptyRow()]));
  const rowFor = (vehicleId) => {
    const key = idOf(vehicleId);
    if (!rows.has(key)) rows.set(key, emptyRow());
    return rows.get(key);
  };

  trips.forEach((trip) => {
    const row = rowFor(trip.vehicleId);
    row.trips += 1;
    row.tripIncome += toNumber(trip.amount);
    row.tripHireCost += toNumber(trip.hireAmount);
    // Km of a per-km trip, or of the meter on older trips that recorded start / end km
    if (trip.billingBasis === "per_km") row.km += toNumber(trip.quantity);
    else if (trip.endKm > trip.startKm) row.km += trip.endKm - trip.startKm;
  });
  contracts.forEach((contract) => {
    const amount = contractAmount(contract, from, to);
    const row = rowFor(contract.vehicleId);
    if (contract.direction === "give_out") row.rentIncome += amount;
    else row.rentCost += amount;
  });
  let generalExpenses = 0;
  const byCategory = {};
  expenses.forEach((expense) => {
    byCategory[expense.category] = round2((byCategory[expense.category] || 0) + toNumber(expense.amount));
    if (expense.vehicleId) rowFor(expense.vehicleId).expenses += toNumber(expense.amount);
    else generalExpenses += toNumber(expense.amount);
  });

  const vehicleById = new Map(vehicles.map((vehicle) => [String(vehicle._id), vehicle]));
  const vehicleRows = [...rows.entries()]
    .filter(([key]) => vehicleById.has(key))
    .map(([key, row]) => {
      const vehicle = vehicleById.get(key);
      return {
        vehicleId: key,
        vehicleNo: vehicle.vehicleNo,
        ownership: vehicle.ownership,
        category: vehicle.category,
        ownerName: vehicle.ownerPartyId?.name || "",
        ...finishRow(Object.fromEntries(Object.entries(row).map(([field, value]) => [field, round2(value)]))),
      };
    })
    .sort((a, b) => b.profit - a.profit);

  const sum = (field) => round2(vehicleRows.reduce((total, row) => total + row[field], 0));
  const totals = {
    trips: sum("trips"),
    tripIncome: sum("tripIncome"),
    rentIncome: sum("rentIncome"),
    tripHireCost: sum("tripHireCost"),
    rentCost: sum("rentCost"),
    vehicleExpenses: sum("expenses"),
    generalExpenses: round2(generalExpenses),
    income: sum("income"),
  };
  totals.cost = round2(totals.tripHireCost + totals.rentCost + totals.vehicleExpenses + totals.generalExpenses);
  totals.profit = round2(totals.income - totals.cost);

  return { from, to, vehicles: vehicleRows, totals, expenseByCategory: byCategory };
};

// Income, cost and profit for each of the last N months, oldest first
const monthlyTrend = async (userId, months = 6) => {
  const now = new Date();
  const result = [];
  for (let back = months - 1; back >= 0; back -= 1) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back + 1, 0));
    const { totals } = await profitReport(userId, from, to);
    result.push({
      month: from.toISOString().slice(0, 7),
      label: from.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }),
      income: totals.income,
      cost: totals.cost,
      profit: totals.profit,
    });
  }
  return result;
};

/**
 * Every money movement with a party, oldest first, with a running balance.
 * Debit (they owe me more): trips billed to them, rent for my vehicle with them, money I paid them.
 * Credit (I owe them more): hire for their vehicle on trips, rent for their vehicle, credit purchases, money they paid me.
 * Balance > 0: they owe me. Balance < 0: I owe them.
 */
const partyLedger = async (userId, partyId, asOf = new Date()) => {
  const party = await Party.findOne({ _id: partyId, userId }).lean();
  if (!party) return null;
  const [billedTrips, hireTrips, contracts, payments, purchases] = await Promise.all([
    Trip.find({ userId, partyId }).populate("vehicleId", "vehicleNo").lean(),
    Trip.find({ userId, hirePartyId: partyId, hireAmount: { $gt: 0 } }).populate("vehicleId", "vehicleNo").lean(),
    Contract.find({ userId, partyId }).populate("vehicleId", "vehicleNo").lean(),
    Payment.find({ userId, partyId }).lean(),
    InventoryTxn.find({ userId, partyId, type: "purchase", paidNow: false }).populate("itemId", "name unit").lean(),
  ]);

  const rows = [];
  const route = (trip) => [trip.from, trip.to].filter(Boolean).join(" → ");
  billedTrips.forEach((trip) => rows.push({
    date: trip.date,
    kind: "Trip",
    ref: trip.tripNo,
    details: `${trip.vehicleId?.vehicleNo || ""} ${route(trip)}`.trim(),
    debit: toNumber(trip.amount),
    credit: 0,
  }));
  hireTrips.forEach((trip) => rows.push({
    date: trip.date,
    kind: "Vehicle Hire",
    ref: trip.tripNo,
    details: `${trip.vehicleId?.vehicleNo || ""} ${route(trip)}`.trim(),
    debit: 0,
    credit: toNumber(trip.hireAmount),
  }));
  contracts.forEach((contract) => {
    contractSegments(contract, null, asOf).forEach((segment) => {
      const label = segment.days === segment.daysInMonth
        ? segment.from.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })
        : `${segment.days} of ${segment.daysInMonth} days`;
      rows.push({
        date: segment.to,
        kind: contract.direction === "give_out" ? "Monthly Rent (given)" : "Monthly Rent (hired)",
        ref: contract.contractNo,
        details: `${contract.vehicleId?.vehicleNo || ""} · ${label}`,
        debit: contract.direction === "give_out" ? segment.amount : 0,
        credit: contract.direction === "hire_in" ? segment.amount : 0,
      });
    });
  });
  payments.forEach((payment) => rows.push({
    date: payment.date,
    kind: payment.type === "received" ? "Received" : "Paid",
    ref: payment.reference || payment.mode.toUpperCase(),
    details: payment.notes,
    debit: payment.type === "paid" ? toNumber(payment.amount) : 0,
    credit: payment.type === "received" ? toNumber(payment.amount) : 0,
  }));
  purchases.forEach((purchase) => rows.push({
    date: purchase.date,
    kind: "Purchase",
    ref: "",
    details: `${purchase.itemId?.name || "Item"} × ${purchase.quantity} ${purchase.itemId?.unit || ""}`.trim(),
    debit: 0,
    credit: toNumber(purchase.amount),
  }));

  rows.sort((a, b) => new Date(a.date) - new Date(b.date));
  let balance = toNumber(party.openingBalance);
  const ledger = rows.map((row) => {
    balance = round2(balance + row.debit - row.credit);
    return { ...row, debit: round2(row.debit), credit: round2(row.credit), balance };
  });
  return {
    party,
    openingBalance: toNumber(party.openingBalance),
    rows: ledger,
    totalDebit: round2(ledger.reduce((total, row) => total + row.debit, 0)),
    totalCredit: round2(ledger.reduce((total, row) => total + row.credit, 0)),
    balance,
  };
};

// Every party's balance today
const partyBalances = async (userId) => {
  const parties = await Party.find({ userId }).lean();
  const balances = await Promise.all(parties.map(async (party) => {
    const ledger = await partyLedger(userId, party._id);
    return { partyId: String(party._id), name: party.name, type: party.type, balance: ledger.balance };
  }));
  return balances;
};

const statusFor = (daysLeft, warnDays) => {
  if (daysLeft === null) return "ok";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= warnDays) return "due_soon";
  return "ok";
};

/**
 * Documents: only the latest of each kind per vehicle counts (an old insurance is replaced by the renewed one).
 * Maintenance: due by km or by days, whichever comes first.
 */
const documentStatus = async (userId) => {
  const [user, docs] = await Promise.all([
    User.findById(userId).select("documentReminderDays").lean(),
    Document.find({ userId }).populate("vehicleId", "vehicleNo status").sort({ expiryDate: -1 }).lean(),
  ]);
  const warnDays = toNumber(user?.documentReminderDays, 15);
  const today = todayNum();
  const latest = new Set();
  return docs.map((doc) => {
    const key = `${idOf(doc.vehicleId)}:${doc.docType}`;
    const superseded = latest.has(key);
    latest.add(key);
    const daysLeft = doc.expiryDate ? dayNum(doc.expiryDate) - today : null;
    return { ...doc, daysLeft, superseded, status: superseded ? "renewed" : statusFor(daysLeft, warnDays) };
  });
};

const maintenanceStatus = async (userId) => {
  const tasks = await Maintenance.find({ userId }).populate("vehicleId", "vehicleNo currentKm status").lean();
  const today = todayNum();
  return tasks.map((task) => {
    const currentKm = toNumber(task.vehicleId?.currentKm);
    const dueKm = task.intervalKm > 0 ? toNumber(task.lastDoneKm) + toNumber(task.intervalKm) : null;
    const kmLeft = dueKm === null ? null : round2(dueKm - currentKm);
    const dueDate = task.intervalDays > 0 && task.lastDoneDate
      ? new Date(dayNum(task.lastDoneDate) * DAY_MS + task.intervalDays * DAY_MS)
      : null;
    const daysLeft = dueDate ? dayNum(dueDate) - today : null;
    const overdue = (kmLeft !== null && kmLeft <= 0) || (daysLeft !== null && daysLeft < 0);
    const soon = (kmLeft !== null && kmLeft <= toNumber(task.alertBeforeKm))
      || (daysLeft !== null && daysLeft <= toNumber(task.alertBeforeDays));
    return {
      ...task,
      currentKm,
      dueKm,
      kmLeft,
      dueDate,
      daysLeft,
      status: overdue ? "overdue" : soon ? "due_soon" : "ok",
    };
  });
};

const alerts = async (userId) => {
  const [docs, tasks, items, user, employees] = await Promise.all([
    documentStatus(userId),
    maintenanceStatus(userId),
    InventoryItem.find({ userId, minStock: { $gt: 0 } }).lean(),
    User.findById(userId).select("documentReminderDays").lean(),
    Employee.find({ userId, isActive: true, licenseExpiry: { $ne: null } }).populate("vehicleId", "vehicleNo").lean(),
  ]);
  const warnDays = toNumber(user?.documentReminderDays, 15);
  // Driving licences of working staff, on the same warning days as vehicle documents
  const licenses = employees
    .map((employee) => {
      const daysLeft = dayNum(employee.licenseExpiry) - todayNum();
      return { ...employee, daysLeft, status: statusFor(daysLeft, warnDays) };
    })
    .filter((employee) => employee.status !== "ok")
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const isLive = (vehicle) => !vehicle || vehicle.status !== "sold";
  const documents = docs
    .filter((doc) => ["expired", "due_soon"].includes(doc.status) && isLive(doc.vehicleId))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const maintenance = tasks
    .filter((task) => task.status !== "ok" && isLive(task.vehicleId))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "overdue" ? -1 : 1));
  const lowStock = items.filter((item) => item.stockQty <= item.minStock);
  return {
    documents,
    maintenance,
    lowStock,
    licenses,
    count: documents.length + maintenance.length + lowStock.length + licenses.length,
    urgent: documents.filter((doc) => doc.status === "expired").length
      + licenses.filter((employee) => employee.status === "expired").length
      + maintenance.filter((task) => task.status === "overdue").length,
  };
};

module.exports = { profitReport, monthlyTrend, partyLedger, partyBalances, documentStatus, maintenanceStatus, alerts };
