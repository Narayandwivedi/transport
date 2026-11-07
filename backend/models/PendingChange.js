const { Schema, ObjectId, owner, text, makeModel } = require("./schemaHelpers");

/**
 * An entry a staff login added or changed while "save on approval" is on.
 * Nothing is saved for real until the owner approves it in the Activity Center; then the stored
 * form data is saved exactly as if the staff had saved it then.
 */
const pendingChangeSchema = new Schema(
  {
    ...owner,
    staffId: { type: ObjectId, ref: "Staff", required: true },
    staffName: text,
    // What kind of entry: trip, diesel, payment, reading, expense
    entity: { type: String, required: true },
    action: { type: String, enum: ["create", "update"], required: true },
    // The entry being changed (update), or the one made on approval (create)
    targetId: { type: ObjectId, default: null },
    // The form data as the staff sent it
    data: { type: Schema.Types.Mixed, default: {} },
    // Shown in the Activity Center: what it is, worked out when it was sent
    summary: {
      date: { type: Date, default: null },
      title: text,
      detail: text,
      amount: { type: Number, default: 0 },
    },
    // For an edit: the entry as it was before
    before: {
      title: text,
      detail: text,
      amount: { type: Number, default: 0 },
    },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewNote: text,
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
pendingChangeSchema.index({ userId: 1, status: 1, createdAt: -1 });
pendingChangeSchema.index({ userId: 1, staffId: 1, createdAt: -1 });

const PendingChange = makeModel("PendingChange", pendingChangeSchema);

module.exports = PendingChange;
