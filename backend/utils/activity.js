const { Vehicle, Party } = require("../models");
const { toNumber, idOf } = require("./common");

/**
 * One-line descriptions of the entries staff can add, for the Activity Center:
 * { date, title, detail, amount }. Works on saved entries (vehicle / party filled in or not)
 * and on form data waiting for approval (ids only).
 */

const join = (parts) => parts.filter(Boolean).join(" · ");
const rupees = (value) => `₹${toNumber(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const vehicleNoOf = async (value, userId) => {
  if (!value) return "";
  if (value.vehicleNo) return value.vehicleNo;
  const vehicle = await Vehicle.findOne({ _id: idOf(value), userId }).select("vehicleNo").lean().catch(() => null);
  return vehicle?.vehicleNo || "";
};
const partyNameOf = async (value, userId) => {
  if (!value) return "";
  if (value.name) return value.name;
  const party = await Party.findOne({ _id: idOf(value), userId }).select("name").lean().catch(() => null);
  return party?.name || "";
};
const paidText = (total, paid, word = "Paid") => {
  const due = toNumber(total) - toNumber(paid);
  if (due <= 0) return word;
  return toNumber(paid) > 0 ? `${rupees(due)} due` : "Credit";
};

const SUMMARIES = {
  trip: async (doc, userId) => ({
    date: doc.date || null,
    title: doc.tripNo ? `Trip ${doc.tripNo}` : "New Trip",
    detail: join([
      await vehicleNoOf(doc.vehicleId, userId),
      [doc.from, doc.to].filter(Boolean).join(" → "),
      await partyNameOf(doc.partyId, userId),
      doc.amount ? paidText(doc.amount, doc.receivedAmount) : "",
    ]),
    amount: toNumber(doc.amount),
  }),
  diesel: async (doc, userId) => ({
    date: doc.date || null,
    title: doc.entryNo ? `Diesel ${doc.entryNo}` : "Diesel Purchase",
    detail: join([
      await vehicleNoOf(doc.vehicleId, userId),
      doc.litres ? `${toNumber(doc.litres)} ltr` : "",
      (await partyNameOf(doc.partyId, userId)) || "Cash",
      doc.amount ? paidText(doc.amount, doc.paidAmount ?? doc.amount) : "",
    ]),
    amount: toNumber(doc.amount),
  }),
  payment: async (doc, userId) => ({
    date: doc.date || null,
    title: doc.type === "paid" ? "Money Paid" : "Money Received",
    detail: join([await partyNameOf(doc.partyId, userId), String(doc.mode || "").toUpperCase(), doc.reference]),
    amount: toNumber(doc.amount),
  }),
  reading: async (doc, userId) => ({
    date: doc.date || null,
    title: "Meter Reading",
    detail: join([
      await vehicleNoOf(doc.vehicleId, userId),
      doc.openingReading !== null && doc.openingReading !== undefined && doc.openingReading !== ""
        ? `${toNumber(doc.openingReading)} → ${doc.closingReading === null || doc.closingReading === undefined || doc.closingReading === "" ? "open" : toNumber(doc.closingReading)}`
        : "",
    ]),
    amount: 0,
  }),
  expense: async (doc, userId) => ({
    date: doc.date || null,
    title: doc.category ? `Expense · ${doc.category}` : "Expense",
    detail: join([await vehicleNoOf(doc.vehicleId, userId), doc.paidTo, doc.notes]),
    amount: toNumber(doc.amount),
  }),
};

const summarizer = (entity) => SUMMARIES[entity];

module.exports = { summarizer, ENTITIES: Object.keys(SUMMARIES) };

/**
 * Every field of an entry as { label, value } lines, for the Activity Center's View.
 * Names (vehicle, party, driver, trip) are looked up when the entry holds only ids.
 */
const { Employee, Trip } = require("../models");

const BASIS_TEXT = { per_trip: "trip", per_km: "km", per_ton: "ton", per_ton_km: "ton per km", per_cft: "cubic foot", fixed: "fixed" };
const qty = (value) => toNumber(value).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const dayText = (value) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const modeText = (value) => String(value || "cash").toUpperCase();
const nameFrom = async (Model, value, userId, field) => {
  if (!value) return "";
  if (value[field]) return value[field];
  const doc = await Model.findOne({ _id: idOf(value), userId }).select(field).lean().catch(() => null);
  return doc?.[field] || "";
};
const chargeText = (basis, quantity, rate, km) => {
  if (basis === "fixed") return `Fixed ${rupees(rate)}`;
  if (basis === "per_ton_km") return `${qty(quantity)} ton × ${qty(km)} km × ${rupees(rate)}`;
  if (basis === "per_trip" && toNumber(quantity) === 1) return `${rupees(rate)} per trip`;
  return `${qty(quantity)} ${BASIS_TEXT[basis] || basis} × ${rupees(rate)}`;
};
const line = (label, value) => ({ label, value: value === undefined || value === null ? "" : String(value) });

const DETAILS = {
  trip: async (doc, userId) => {
    const total = toNumber(doc.amount);
    const received = toNumber(doc.receivedAmount);
    const expenses = (doc.expenses || []).filter((row) => toNumber(row.amount) > 0);
    return [
      line("Trip No.", doc.tripNo || "Given when saved"),
      line("Date", dayText(doc.date)),
      line("Vehicle", await vehicleNoOf(doc.vehicleId, userId)),
      line("Driver", await nameFrom(Employee, doc.driverId, userId, "name")),
      line("Bill To", await partyNameOf(doc.partyId, userId)),
      line("Route", [doc.from, doc.to].filter(Boolean).join(" → ")),
      line("Charge", chargeText(doc.billingBasis || "per_trip", doc.quantity, doc.rate, doc.distanceKm)),
      line("Transport", rupees(doc.freightAmount ?? total)),
      line("Material", doc.material ? `${doc.material}${doc.materialBy === "me" ? ` (we supplied, ${rupees(doc.materialAmount)})` : " (party loads)"}` : ""),
      line("Total Bill", rupees(total)),
      line("Paid Now", received > 0 ? `${rupees(received)} by ${modeText(doc.receivedMode)}` : "Nothing (credit)"),
      line("Balance Due", rupees(Math.max(0, total - received))),
      line("Owner Pay", toNumber(doc.hireAmount) > 0 ? rupees(doc.hireAmount) : ""),
      line("Trip Expenses", expenses.map((row) => `${row.category} ${rupees(row.amount)}`).join(", ")),
      line("Status", { planned: "Planned", running: "On the way", completed: "Completed" }[doc.status] || doc.status),
      line("Notes", doc.notes),
    ];
  },
  diesel: async (doc, userId) => {
    const total = toNumber(doc.amount);
    const paid = toNumber(doc.paidAmount ?? total);
    return [
      line("Entry No.", doc.entryNo || "Given when saved"),
      line("Date", dayText(doc.date)),
      line("Vehicle", await vehicleNoOf(doc.vehicleId, userId)),
      line("Trip", (await nameFrom(Trip, doc.tripId, userId, "tripNo")) || "No trip"),
      line("Petrol Pump", (await partyNameOf(doc.partyId, userId)) || "Cash (no pump)"),
      line("Litres", `${qty(doc.litres)} ltr`),
      line("Rate", `${rupees(doc.rate)}/ltr`),
      line("Amount", rupees(total)),
      line("Paid Now", paid > 0 ? `${rupees(paid)} by ${modeText(doc.mode)}` : "Nothing (credit)"),
      line("Due to Pump", rupees(Math.max(0, total - paid))),
      line("Meter Reading", toNumber(doc.meterReading) > 0 ? qty(doc.meterReading) : ""),
      line("Bill / Slip No.", doc.billNo),
      line("Notes", doc.notes),
    ];
  },
  payment: async (doc, userId) => [
    line("Type", doc.type === "paid" ? "Money Paid" : "Money Received"),
    line("Date", dayText(doc.date)),
    line("Party", await partyNameOf(doc.partyId, userId)),
    line("Amount", rupees(doc.amount)),
    line("Mode", modeText(doc.mode)),
    line("Reference", doc.reference),
    line("Notes", doc.notes),
  ],
  reading: async (doc, userId) => {
    const opening = doc.openingReading;
    const closing = doc.closingReading;
    const has = (value) => value !== null && value !== undefined && value !== "";
    return [
      line("Date", dayText(doc.date)),
      line("Vehicle", await vehicleNoOf(doc.vehicleId, userId)),
      line("Opening", has(opening) ? qty(opening) : ""),
      line("Closing", has(closing) ? qty(closing) : "Not entered yet"),
      line("Run", has(opening) && has(closing) ? qty(toNumber(closing) - toNumber(opening)) : ""),
      line("Notes", doc.notes),
    ];
  },
  expense: async (doc, userId) => [
    line("Date", dayText(doc.date)),
    line("Vehicle", await vehicleNoOf(doc.vehicleId, userId)),
    line("Expense Type", doc.category),
    line("Amount", rupees(doc.amount)),
    line("Paid To", doc.paidTo),
    line("Mode", modeText(doc.mode)),
    line("Odometer", toNumber(doc.odometer) > 0 ? qty(doc.odometer) : ""),
    line("Notes", doc.notes),
  ],
};

// Lines with a value only
const detailsOf = async (entity, doc, userId) => {
  const build = DETAILS[entity];
  if (!build || !doc) return [];
  return (await build(doc, userId)).filter((row) => row.value !== "");
};

module.exports.detailsOf = detailsOf;
