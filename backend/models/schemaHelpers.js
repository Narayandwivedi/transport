const mongoose = require("mongoose");

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

// Who added or last changed a record: the owner, or one of their staff logins
const actorSchema = new Schema(
  {
    kind: { type: String, enum: ["owner", "staff"] },
    id: { type: String, default: "" },
    name: { type: String, default: "" },
  },
  { _id: false }
);

// Every record belongs to one account; all lists are filtered by it.
// createdBy / updatedBy: who made it (records saved before this was kept count as the owner's)
const owner = {
  userId: { type: ObjectId, ref: "User", required: true, index: true },
  createdBy: { type: actorSchema, default: undefined },
  updatedBy: { type: actorSchema, default: undefined },
};
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
