const { Schema, text, makeModel } = require("./schemaHelpers");

const userSchema = new Schema(
  {
    name: { type: String, trim: true, required: true },
    companyName: text,
    email: { type: String, trim: true, lowercase: true, default: "" },
    mobile: { type: String, trim: true, default: "" },
    password: { type: String, required: true },
    address: text,
    gstin: { type: String, trim: true, uppercase: true, default: "" },
    // Printed at the bottom of every quotation
    quotationTerms: text,
    // Days before expiry a document starts showing as "expiring soon"
    documentReminderDays: { type: Number, default: 15, min: 0 },
  },
  { timestamps: true }
);

const User = makeModel("User", userSchema);

module.exports = User;
