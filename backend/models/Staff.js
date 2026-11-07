const { Schema, owner, text, makeModel } = require("./schemaHelpers");

// The entries a staff login can be allowed to add, one switch each
const STAFF_ENTRY_TYPES = ["trip", "diesel", "received", "paid", "reading", "expense"];

/**
 * A staff login of an account (userId = the owner). Staff sign in with their mobile and password,
 * see only the add buttons and their own entries, and can do only what the owner switched on.
 */
const staffSchema = new Schema(
  {
    ...owner,
    name: { type: String, trim: true, required: true },
    // Signs in with this; unique across all staff logins
    mobile: { type: String, trim: true, required: true },
    password: { type: String, required: true, select: false },
    isActive: { type: Boolean, default: true },
    // Which entries they may add
    canAdd: Object.fromEntries(STAFF_ENTRY_TYPES.map((key) => [key, { type: Boolean, default: true }])),
    // Changing the entries they added themselves:
    //   none: not allowed. direct: saved at once. request: waits for the owner's approval.
    //   request_after_days: saved at once while the entry is up to editDays old, older ones wait for approval
    editMode: { type: String, enum: ["none", "direct", "request", "request_after_days"] },
    editDays: { type: Number, default: 5, min: 0 },
    // Before editMode existed: may edit (the approval switch then decided how)
    canEdit: { type: Boolean, default: false },
    // Also sees the owner's entries (read only), not just their own
    seeOwnerEntries: { type: Boolean, default: false },
    // What they add waits in the Activity Center until the owner approves it
    needsApproval: { type: Boolean, default: true },
    notes: text,
  },
  { timestamps: true }
);
staffSchema.index({ mobile: 1 }, { unique: true });

// How this login may edit; logins made before editMode existed keep working as they did
const editModeOf = (staff) => {
  if (!staff) return "direct";
  if (staff.editMode) return staff.editMode;
  if (!staff.canEdit) return "none";
  return staff.needsApproval === false ? "direct" : "request";
};

const Staff = makeModel("Staff", staffSchema);
Staff.STAFF_ENTRY_TYPES = STAFF_ENTRY_TYPES;
Staff.EDIT_MODES = ["none", "direct", "request", "request_after_days"];
Staff.editModeOf = editModeOf;

module.exports = Staff;
