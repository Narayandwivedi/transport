const { Vehicle, Trip, MeterReading, DieselEntry, InventoryItem, InventoryTxn } = require("../models");
const { dayNum, round2, toNumber, idOf, DAY_MS } = require("./common");

/**
 * Long-term mileage of each vehicle over a period:
 *   km run      = highest meter seen in the period − lowest meter seen in the period
 *   diesel used = diesel put in (pump fills + diesel issued from stock) from the day of the lowest reading
 *                 up to, but not on, the day of the highest reading (diesel filled then is not burnt yet)
 *   mileage     = km ÷ litres (km/l); for an hour meter, litres ÷ hours (ltr/hr, lower is better)
 * Meter readings come from every place the meter is noted: meter reading entries, diesel fills,
 * stock issues and trips' start / end km. Averaging over a long period means it works whether or not
 * the tank is filled full each time.
 */

// Worse than the vehicle's expected mileage by more than this share counts as low
const LOW_MARGIN = 0.1;

// From `months` months back to today; 0 months = all time
const periodOf = (months) => {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = months > 0 ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate())) : null;
  return { from, to };
};

const dateFilter = (from, to) => {
  const range = { $lte: new Date(to.getTime() + DAY_MS - 1) };
  if (from) range.$gte = from;
  return range;
};

// The reading lowest on the meter (the latest day it stood there) and the highest (the first day it got there)
const lowestAndHighest = (points) => {
  let low = null;
  let high = null;
  points.forEach((point) => {
    if (!low || point.value < low.value || (point.value === low.value && point.day > low.day)) low = point;
    if (!high || point.value > high.value || (point.value === high.value && point.day < high.day)) high = point;
  });
  return { low, high };
};

const mileageFor = (vehicle, points, fills) => {
  const unit = vehicle.meterUnit === "hrs" ? "hrs" : "km";
  const expected = toNumber(vehicle.expectedMileage) || null;
  const totalLitres = round2(fills.reduce((sum, fill) => sum + fill.litres, 0));
  const base = {
    vehicleId: vehicle._id,
    vehicleNo: vehicle.vehicleNo,
    category: vehicle.category,
    status: vehicle.status,
    unit,
    expected,
    readings: points.length,
    totalLitres,
    fills: fills.length,
  };
  const noData = (reason) => ({ ...base, state: "no_data", reason, km: 0, litres: 0, amount: 0, mileage: null, costPerUnit: null, low: null, high: null, entries: [] });

  if (points.length < 2) return noData(points.length ? "Only one meter reading in this period" : "No meter readings in this period");
  const { low, high } = lowestAndHighest(points);
  const run = round2(high.value - low.value);
  if (!(run > 0)) return noData("The meter did not move in this period");
  if (high.day < low.day) return noData("Meter readings go down over time. Check the readings.");

  // Diesel burnt between the two readings
  const counted = fills.filter((fill) => fill.day >= low.day && fill.day < high.day);
  const litres = round2(counted.reduce((sum, fill) => sum + fill.litres, 0));
  const amount = round2(counted.reduce((sum, fill) => sum + fill.amount, 0));
  if (!(litres > 0)) return { ...noData("No diesel entered between the first and last reading"), km: run, low, high };

  const mileage = unit === "hrs" ? round2(litres / run) : round2(run / litres);
  let state = "ok";
  if (expected) {
    const isLow = unit === "hrs" ? mileage > expected * (1 + LOW_MARGIN) : mileage < expected * (1 - LOW_MARGIN);
    if (isLow) state = "low";
  }
  return {
    ...base,
    state,
    reason: "",
    km: run,
    litres,
    amount,
    mileage,
    // Diesel cost per km (or per hour)
    costPerUnit: round2(amount / run),
    // How far off the expected mileage, as a share (negative = worse for km/l, positive = worse for ltr/hr)
    vsExpected: expected ? round2((mileage - expected) / expected) : null,
    low,
    high,
    // The diesel entries that went into the figure, newest first
    entries: counted.sort((a, b) => b.day - a.day),
  };
};

/**
 * Mileage of every vehicle (or one) over the last `months` months (0 = all time).
 * Sold vehicles are left out unless asked for by id.
 */
const mileageReport = async (userId, { months = 3, vehicleId = "" } = {}) => {
  const { from, to } = periodOf(toNumber(months));
  const vehicleQuery = vehicleId ? { userId, _id: vehicleId } : { userId, status: { $ne: "sold" } };
  const vehicles = await Vehicle.find(vehicleQuery).select("vehicleNo meterUnit expectedMileage category status").sort({ vehicleNo: 1 }).lean();
  const ids = vehicles.map((vehicle) => vehicle._id);
  const date = dateFilter(from, to);
  const dieselItems = await InventoryItem.find({ userId, category: "diesel" }).select("_id").lean();

  const [readings, dieselEntries, issues, trips] = await Promise.all([
    MeterReading.find({ userId, vehicleId: { $in: ids }, date }).select("vehicleId date openingReading closingReading reading").lean(),
    DieselEntry.find({ userId, vehicleId: { $in: ids }, date }).select("vehicleId date litres amount meterReading entryNo").lean(),
    dieselItems.length
      ? InventoryTxn.find({ userId, type: "issue", itemId: { $in: dieselItems.map((item) => item._id) }, vehicleId: { $in: ids }, date }).select("vehicleId date quantity amount odometer").lean()
      : [],
    Trip.find({ userId, vehicleId: { $in: ids }, date, $or: [{ startKm: { $gt: 0 } }, { endKm: { $gt: 0 } }] }).select("vehicleId date startKm endKm tripNo").lean(),
  ]);

  const pointsOf = {};
  const fillsOf = {};
  const addPoint = (vehicle, when, value, source, ref = "") => {
    const reading = toNumber(value);
    if (!(reading > 0)) return;
    const key = idOf(vehicle);
    (pointsOf[key] = pointsOf[key] || []).push({ day: dayNum(when), date: when, value: reading, source, ref });
  };
  const addFill = (vehicle, when, litres, amount, source, ref, meter) => {
    if (!(toNumber(litres) > 0)) return;
    const key = idOf(vehicle);
    (fillsOf[key] = fillsOf[key] || []).push({ day: dayNum(when), date: when, litres: toNumber(litres), amount: toNumber(amount), source, ref, meter: toNumber(meter) || null });
  };

  readings.forEach((row) => {
    addPoint(row.vehicleId, row.date, row.openingReading, "meter");
    addPoint(row.vehicleId, row.date, row.closingReading ?? row.reading, "meter");
  });
  dieselEntries.forEach((row) => {
    addPoint(row.vehicleId, row.date, row.meterReading, "diesel", row.entryNo);
    addFill(row.vehicleId, row.date, row.litres, row.amount, "pump", row.entryNo, row.meterReading);
  });
  issues.forEach((row) => {
    addPoint(row.vehicleId, row.date, row.odometer, "stock");
    addFill(row.vehicleId, row.date, row.quantity, row.amount, "stock", "", row.odometer);
  });
  trips.forEach((row) => {
    addPoint(row.vehicleId, row.date, row.startKm, "trip", row.tripNo);
    addPoint(row.vehicleId, row.date, row.endKm, "trip", row.tripNo);
  });

  const rows = vehicles.map((vehicle) => mileageFor(vehicle, pointsOf[idOf(vehicle._id)] || [], fillsOf[idOf(vehicle._id)] || []));
  // Fleet average over km vehicles that have a figure
  const kmRows = rows.filter((row) => row.unit === "km" && row.mileage !== null);
  const fleetKm = round2(kmRows.reduce((sum, row) => sum + row.km, 0));
  const fleetLitres = round2(kmRows.reduce((sum, row) => sum + row.litres, 0));
  return {
    months: toNumber(months),
    from,
    to,
    lowMargin: LOW_MARGIN,
    vehicles: rows,
    fleet: {
      km: fleetKm,
      litres: fleetLitres,
      mileage: fleetLitres > 0 ? round2(fleetKm / fleetLitres) : null,
      amount: round2(kmRows.reduce((sum, row) => sum + row.amount, 0)),
      lowCount: rows.filter((row) => row.state === "low").length,
      noDataCount: rows.filter((row) => row.state === "no_data").length,
    },
  };
};

module.exports = { mileageReport, mileageFor, LOW_MARGIN };
