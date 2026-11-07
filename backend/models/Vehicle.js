const { Schema, owner, ref, money, text, BILLING_BASES, makeModel } = require("./schemaHelpers");

const vehicleSchema = new Schema(
  {
    ...owner,
    vehicleNo: { type: String, trim: true, uppercase: true, required: true },
    category: { type: String, enum: ["truck", "trailer", "hyva", "tanker", "container", "pickup", "jcb", "other"], default: "truck" },
    // own: my vehicle. hired: taken from ownerPartyId (per trip / km / ton, or monthly through a hire contract)
    ownership: { type: String, enum: ["own", "hired"], default: "own" },
    ownerPartyId: ref("Party"),
    hireBasis: { type: String, enum: ["", ...BILLING_BASES], default: "" },
    hireRate: money,
    /**
     * Agreed rates for routes this vehicle runs, each per trip, per km or per ton:
     * what the party is billed, and for a hired vehicle what its owner is paid on the same basis.
     */
    routeRates: [
      {
        _id: false,
        from: { type: String, trim: true, required: true },
        to: { type: String, trim: true, required: true },
        basis: { type: String, enum: ["per_trip", "per_km", "per_ton"], default: "per_trip" },
        rate: money,
        hireRate: money,
        // Route length, used as the km of a per-km trip when no meter km is entered
        distanceKm: money,
      },
    ],
    make: text,
    model: text,
    capacityTons: money,
    // What the meter counts: km (odometer) or hrs (hour meter, e.g. JCB / machines)
    meterUnit: { type: String, enum: ["km", "hrs"], default: "km" },
    // Latest meter reading (km or hrs as meterUnit says), kept up to date from meter readings and trips
    currentKm: money,
    // What the vehicle should give: km per litre, or litres per hour on an hour meter; 0 = not set
    expectedMileage: money,
    driverName: text,
    driverMobile: text,
    status: { type: String, enum: ["active", "inactive", "sold"], default: "active" },
    notes: text,
  },
  { timestamps: true }
);
vehicleSchema.index({ userId: 1, vehicleNo: 1 }, { unique: true });

const Vehicle = makeModel("Vehicle", vehicleSchema);

module.exports = Vehicle;
