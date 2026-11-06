const { Counter } = require("../models");

/**
 * Dates are whole days. The app sends "2026-10-19", which is stored as midnight UTC,
 * so all day maths here runs in UTC and never shifts a day with the server's time zone.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const dayNum = (value) => Math.floor(new Date(value).getTime() / DAY_MS);
const fromDayNum = (num) => new Date(num * DAY_MS);
const todayNum = () => dayNum(new Date().toISOString().slice(0, 10));

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const round2 = (value) => Math.round(toNumber(value) * 100) / 100;

// "2026-10" for today
const currentMonth = () => new Date().toISOString().slice(0, 7);

// "2026-10" → first and last day of that month (Date objects at midnight UTC)
const monthRange = (month) => {
  const [year, mon] = String(month || "").split("-").map(Number);
  const now = new Date();
  const y = year || now.getUTCFullYear();
  const m = mon ? mon - 1 : now.getUTCMonth();
  return { from: new Date(Date.UTC(y, m, 1)), to: new Date(Date.UTC(y, m + 1, 0)) };
};

// { date: { $gte, $lte } } from ?from=&to= day strings
const dateFilter = (field, from, to) => {
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return Object.keys(range).length ? { [field]: range } : {};
};

// TR-0001, TR-0002 … per account
const nextNumber = async (userId, key, prefix) => {
  const counter = await Counter.findOneAndUpdate(
    { userId, key },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  );
  return `${prefix}-${String(counter.seq).padStart(4, "0")}`;
};

/**
 * Monthly rent split into calendar-month pieces between two days (both counted).
 * A part month is charged for the days used: rate × days ÷ days in that month.
 */
const contractSegments = (contract, from, to) => {
  const start = Math.max(dayNum(contract.startDate), from ? dayNum(from) : -Infinity);
  const end = Math.min(contract.endDate ? dayNum(contract.endDate) : Infinity, to ? dayNum(to) : todayNum());
  const segments = [];
  let cursor = start;
  while (Number.isFinite(cursor) && cursor <= end) {
    const date = fromDayNum(cursor);
    const monthStart = dayNum(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const monthEnd = dayNum(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    const segmentEnd = Math.min(end, monthEnd);
    const days = segmentEnd - cursor + 1;
    const daysInMonth = monthEnd - monthStart + 1;
    segments.push({
      from: fromDayNum(cursor),
      to: fromDayNum(segmentEnd),
      days,
      daysInMonth,
      amount: round2((toNumber(contract.monthlyRate) * days) / daysInMonth),
    });
    cursor = segmentEnd + 1;
  }
  return segments;
};

const contractAmount = (contract, from, to) => round2(
  contractSegments(contract, from, to).reduce((total, segment) => total + segment.amount, 0)
);

const idOf = (value) => String(value?._id || value || "");

// Quantity × rate, the rate itself for a fixed amount, or tons × km × rate per ton per km
const lineAmount = (basis, quantity, rate, km = 0) => {
  if (basis === "fixed") return round2(toNumber(rate));
  if (basis === "per_ton_km") return round2(toNumber(quantity) * toNumber(km) * toNumber(rate));
  return round2(toNumber(quantity) * toNumber(rate));
};

// "raipur|bilaspur": a route matched without caring about capitals or spaces
const routeKey = (row) => `${String(row.from || "").trim().toLowerCase()}|${String(row.to || "").trim().toLowerCase()}`;

module.exports = {
  DAY_MS,
  dayNum,
  fromDayNum,
  todayNum,
  toNumber,
  round2,
  monthRange,
  currentMonth,
  dateFilter,
  nextNumber,
  contractSegments,
  contractAmount,
  idOf,
  lineAmount,
  routeKey,
};
