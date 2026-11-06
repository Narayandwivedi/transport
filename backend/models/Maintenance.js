const { Schema, ObjectId, owner, money, text, makeModel } = require("./schemaHelpers");

// Service due every N km and/or every N days, counted from when it was last done
const maintenanceSchema = new Schema(
  {
    ...owner,
    vehicleId: { type: ObjectId, ref: "Vehicle", required: true },
    title: { type: String, trim: true, required: true },
    intervalKm: money,
    intervalDays: money,
    lastDoneKm: money,
    lastDoneDate: { type: Date, default: null },
    // Warn this many km / days before it falls due
    alertBeforeKm: { type: Number, default: 500, min: 0 },
    alertBeforeDays: { type: Number, default: 7, min: 0 },
    history: [
      {
        _id: false,
        date: Date,
        km: Number,
        cost: Number,
        notes: String,
      },
    ],
    notes: text,
  },
  { timestamps: true }
);

const Maintenance = makeModel("Maintenance", maintenanceSchema);

module.exports = Maintenance;
