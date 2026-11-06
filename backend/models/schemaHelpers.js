const mongoose = require("mongoose");

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

// Every record belongs to one account; all lists are filtered by it
const owner = { userId: { type: ObjectId, ref: "User", required: true, index: true } };
const ref = (model) => ({ type: ObjectId, ref: model, default: null });
const money = { type: Number, default: 0, min: 0 };
const text = { type: String, trim: true, default: "" };

// How a trip or a hired vehicle is charged
const BILLING_BASES = ["per_trip", "per_km", "per_ton", "fixed"];
// A trip can also be charged per ton per km (tons × km × rate) or per cubic foot (cft × rate)
const TRIP_BASES = [...BILLING_BASES, "per_ton_km", "per_cft"];

// Reuses the model when the file is loaded twice (e.g. node --watch)
const makeModel = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

module.exports = { Schema, ObjectId, owner, ref, money, text, BILLING_BASES, TRIP_BASES, makeModel };
