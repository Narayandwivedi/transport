const { Schema, owner, makeModel } = require("./schemaHelpers");

const counterSchema = new Schema({
  ...owner,
  key: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
counterSchema.index({ userId: 1, key: 1 }, { unique: true });

const Counter = makeModel("Counter", counterSchema);

module.exports = Counter;
