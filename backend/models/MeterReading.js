const { Schema, ObjectId, owner, text, makeModel } = require("./schemaHelpers");

// One day's (or trip's) run of a vehicle: odometer at the start and at the end
const meterReadingSchema = new Schema(
  {
    ...owner,
    vehicleId: { type: ObjectId, ref: "Vehicle", required: true },
    date: { type: Date, required: true },
    openingReading: { type: Number, min: 0, default: null },
    // null while the vehicle is still out: the closing is filled in at the end of the day
    closingReading: { type: Number, min: 0, default: null },
    // The highest km this entry shows (closing, or opening while still open); the odometer is worked out from it
    reading: { type: Number, min: 0, default: 0 },
    notes: text,
  },
  { timestamps: true }
);
meterReadingSchema.pre("validate", function setReading() {
  // Entries saved before opening / closing existed had only "reading": it is their closing
  if (this.openingReading === null && this.closingReading === null) this.closingReading = this.reading;
  this.reading = this.closingReading ?? this.openingReading ?? 0;
});
meterReadingSchema.index({ userId: 1, vehicleId: 1, date: -1 });

const MeterReading = makeModel("MeterReading", meterReadingSchema);

module.exports = MeterReading;
