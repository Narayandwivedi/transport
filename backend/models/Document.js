const { Schema, ObjectId, owner, money, text, makeModel } = require("./schemaHelpers");

const DOCUMENT_TYPES = ["tax", "insurance", "fitness", "puc", "gps", "permit", "rc", "national_permit", "other"];

const documentSchema = new Schema(
  {
    ...owner,
    vehicleId: { type: ObjectId, ref: "Vehicle", required: true },
    docType: { type: String, enum: DOCUMENT_TYPES, required: true },
    docNumber: text,
    provider: text,
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    amount: money,
    file: text,
    fileName: text,
    notes: text,
  },
  { timestamps: true }
);

const Document = makeModel("Document", documentSchema);

module.exports = Document;
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
