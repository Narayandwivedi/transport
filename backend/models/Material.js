const { Schema, owner, text, makeModel } = require("./schemaHelpers");

// Materials I supply on trips (sand, gitti, cement…), picked from a list on Add Trip
const materialSchema = new Schema(
  {
    ...owner,
    name: { type: String, trim: true, required: true },
    notes: text,
  },
  { timestamps: true }
);
materialSchema.index({ userId: 1, name: 1 });

const Material = makeModel("Material", materialSchema);

module.exports = Material;
