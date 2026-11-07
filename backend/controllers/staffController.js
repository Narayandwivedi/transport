const bcrypt = require("bcryptjs");
const { Staff, PendingChange } = require("../models");

/** Staff logins of the account, managed by the owner in Settings. */

const { STAFF_ENTRY_TYPES } = Staff;
const refuse = (res, message, status = 400) => res.status(status).json({ message });
const cleanMobile = (value) => String(value || "").replace(/\D/g, "").slice(-10);

// Only known switches, as true / false
const readSwitches = (body) => {
  const data = {};
  if (body.canAdd && typeof body.canAdd === "object") {
    data.canAdd = Object.fromEntries(STAFF_ENTRY_TYPES.map((key) => [key, body.canAdd[key] !== false]));
  }
  ["seeOwnerEntries", "needsApproval", "isActive"].forEach((key) => {
    if (body[key] !== undefined) data[key] = Boolean(body[key]);
  });
  if (body.editMode !== undefined) {
    data.editMode = Staff.EDIT_MODES.includes(body.editMode) ? body.editMode : "none";
    data.canEdit = data.editMode !== "none";
  } else if (body.canEdit !== undefined) {
    // The older yes / no switch: how edits save then follows "save on approval"
    data.canEdit = Boolean(body.canEdit);
  }
  if (body.editDays !== undefined) data.editDays = Math.max(0, Math.round(Number(body.editDays) || 0));
  return data;
};

const list = async (req, res) => {
  const [rows, waiting] = await Promise.all([
    Staff.find({ userId: req.userId }).sort({ name: 1 }).lean(),
    PendingChange.aggregate([{ $match: { userId: req.userId, status: "pending" } }, { $group: { _id: "$staffId", n: { $sum: 1 } } }]),
  ]);
  const waitingOf = new Map(waiting.map((row) => [String(row._id), row.n]));
  res.json(rows.map((row) => ({ ...row, editMode: Staff.editModeOf(row), pendingCount: waitingOf.get(String(row._id)) || 0 })));
};

const create = async (req, res) => {
  const name = String(req.body.name || "").trim();
  const mobile = cleanMobile(req.body.mobile);
  const password = String(req.body.password || "");
  if (!name) return refuse(res, "Enter the staff name");
  if (mobile.length !== 10) return refuse(res, "Enter a 10-digit mobile number; staff sign in with it");
  if (password.length < 4) return refuse(res, "Password must be at least 4 characters");
  if (await Staff.exists({ mobile })) return refuse(res, "This mobile number is already a staff login");
  const staff = await Staff.create({
    userId: req.userId,
    name,
    mobile,
    password: await bcrypt.hash(password, 10),
    ...readSwitches(req.body),
    notes: String(req.body.notes || "").trim(),
  });
  res.status(201).json(await Staff.findById(staff._id).lean());
};

const update = async (req, res) => {
  const staff = await Staff.findOne({ _id: req.params.id, userId: req.userId });
  if (!staff) return refuse(res, "Staff not found", 404);
  if (req.body.name !== undefined) {
    const name = String(req.body.name || "").trim();
    if (!name) return refuse(res, "Enter the staff name");
    staff.name = name;
  }
  if (req.body.mobile !== undefined) {
    const mobile = cleanMobile(req.body.mobile);
    if (mobile.length !== 10) return refuse(res, "Enter a 10-digit mobile number");
    if (mobile !== staff.mobile && (await Staff.exists({ mobile }))) return refuse(res, "This mobile number is already a staff login");
    staff.mobile = mobile;
  }
  // A new password only when one is typed
  if (req.body.password) {
    if (String(req.body.password).length < 4) return refuse(res, "Password must be at least 4 characters");
    staff.password = await bcrypt.hash(String(req.body.password), 10);
  }
  if (req.body.notes !== undefined) staff.notes = String(req.body.notes || "").trim();
  staff.set(readSwitches(req.body));
  await staff.save();
  res.json(await Staff.findById(staff._id).lean());
};

// Their saved entries stay (marked as added by them); anything still waiting for approval goes
const remove = async (req, res) => {
  const staff = await Staff.findOne({ _id: req.params.id, userId: req.userId });
  if (!staff) return refuse(res, "Staff not found", 404);
  await PendingChange.deleteMany({ userId: req.userId, staffId: staff._id, status: "pending" });
  await staff.deleteOne();
  res.json({ success: true });
};

module.exports = { list, create, update, remove, STAFF_ENTRY_TYPES };
