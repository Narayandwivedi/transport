const { PendingChange, Staff, Trip, DieselEntry, Payment, MeterReading, Expense } = require("../models");
const { registry } = require("../utils/crud");
const { summarizer, detailsOf } = require("../utils/activity");
const { DAY_MS } = require("../utils/common");

/**
 * Activity Center.
 * Owner: entries waiting for approval (approve / reject), every entry saved in a period with who added it,
 * and the ones already reviewed. Staff: their own entries (and the owner's when allowed), with the state of
 * anything waiting for approval.
 */

// The entry kinds staff can add, and how to list each
const ENTRY_MODELS = [
  { entity: "trip", Model: Trip, populate: "vehicleId partyId driverId" },
  { entity: "diesel", Model: DieselEntry, populate: "vehicleId partyId tripId" },
  { entity: "payment", Model: Payment, populate: "partyId" },
  { entity: "reading", Model: MeterReading, populate: "vehicleId" },
  // Expenses made by trips, diesel, stock or payroll show under those entries
  { entity: "expense", Model: Expense, populate: "vehicleId", extra: { source: "manual" } },
];

const refuse = (res, status, message) => res.status(status).json({ message });

// ?days=7 back from today, or ?from=&to= days; whole days in UTC like the rest of the app
const periodOf = (query) => {
  const today = new Date(new Date().toISOString().slice(0, 10));
  if (query.from) {
    const from = new Date(query.from);
    const to = new Date(query.to || query.from);
    return { from, to: new Date(to.getTime() + DAY_MS - 1) };
  }
  const days = Math.min(366, Math.max(1, Number(query.days) || 7));
  return { from: new Date(today.getTime() - (days - 1) * DAY_MS), to: new Date(today.getTime() + DAY_MS - 1) };
};

const byOf = (doc) => (doc.createdBy?.kind === "staff" ? { kind: "staff", id: doc.createdBy.id, name: doc.createdBy.name } : { kind: "owner", id: "", name: "Owner" });

// Saved entries made in the period, newest first; `who` narrows to some people
const savedEntries = async (userId, period, who = null) => {
  const lists = await Promise.all(ENTRY_MODELS.map(async ({ entity, Model, populate, extra }) => {
    const query = { userId, createdAt: { $gte: period.from, $lte: period.to }, ...(extra || {}) };
    if (who) query.$and = [who];
    const rows = await Model.find(query).sort({ createdAt: -1 }).limit(500).populate(populate).lean();
    const describe = summarizer(entity);
    return Promise.all(rows.map(async (doc) => ({
      id: String(doc._id),
      entity,
      ...(await describe(doc, userId)),
      createdAt: doc.createdAt,
      edited: Boolean(doc.updatedBy?.kind),
      by: byOf(doc),
      doc,
    })));
  }));
  return lists.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const changeRow = (change) => ({
  id: String(change._id),
  entity: change.entity,
  action: change.action,
  status: change.status,
  staffId: String(change.staffId),
  staffName: change.staffName,
  summary: change.summary,
  before: change.action === "update" ? change.before : null,
  reviewNote: change.reviewNote,
  reviewedAt: change.reviewedAt,
  createdAt: change.createdAt,
  targetId: change.targetId ? String(change.targetId) : "",
});

// GET /activity/pending (owner): everything waiting, oldest first so it is dealt with in order
const pending = async (req, res) => {
  const rows = await PendingChange.find({ userId: req.userId, status: "pending" }).sort({ createdAt: 1 }).lean();
  // With their lines, so each card can show the main facts without opening View
  res.json(await Promise.all(rows.map(async (change) => ({ ...changeRow(change), ...(await changeDetails(change, req.userId)) }))));
};

// GET /activity/reviewed?days= (owner): approved and rejected, newest first
const reviewed = async (req, res) => {
  const period = periodOf(req.query);
  const rows = await PendingChange.find({ userId: req.userId, status: { $ne: "pending" }, reviewedAt: { $gte: period.from, $lte: period.to } })
    .sort({ reviewedAt: -1 }).limit(300).lean();
  res.json(rows.map(changeRow));
};

// GET /activity/feed?days=&by=owner|<staffId> (owner): every entry saved in the period with who added it
const feed = async (req, res) => {
  const period = periodOf(req.query);
  let who = null;
  if (req.query.by === "owner") who = { "createdBy.kind": { $ne: "staff" } };
  else if (req.query.by) who = { "createdBy.kind": "staff", "createdBy.id": String(req.query.by) };
  const [rows, staff] = await Promise.all([
    savedEntries(req.userId, period, who),
    Staff.find({ userId: req.userId }).select("name").sort({ name: 1 }).lean(),
  ]);
  res.json({
    from: period.from,
    to: period.to,
    staff: staff.map((row) => ({ id: String(row._id), name: row.name })),
    // With every line of each entry, so the list shows the facts without opening View
    rows: await Promise.all(rows.map(async ({ doc, ...row }) => ({ ...row, details: await detailsOf(row.entity, doc, req.userId) }))),
  });
};

// The stored form data saved for real, as the staff who sent it
const applyChange = async (change) => {
  const handler = registry[change.entity];
  if (!handler) throw Object.assign(new Error("This kind of entry can no longer be approved."), { status: 400 });
  const staff = await Staff.findById(change.staffId).lean();
  const actor = { kind: "staff", id: String(change.staffId), name: change.staffName || staff?.name || "Staff" };
  // The same request the staff made, so the form's own checks and totals run again
  const req = { userId: change.userId, staff: staff || { _id: change.staffId, name: actor.name } };
  const body = JSON.parse(JSON.stringify(change.data || {}));
  if (change.action === "create") {
    const doc = await handler.createDoc(req, body, actor);
    return doc._id;
  }
  const doc = await handler.Model.findOne({ _id: change.targetId, userId: change.userId });
  if (!doc) throw Object.assign(new Error("The entry this change was for has been deleted."), { status: 400 });
  await handler.updateDoc(req, doc, body, actor);
  return doc._id;
};

const findPending = (req) => PendingChange.findOne({ _id: req.params.id, userId: req.userId, status: "pending" });

// POST /activity/pending/:id/approve (owner)
const approve = async (req, res) => {
  const change = await findPending(req);
  if (!change) return refuse(res, 404, "Already reviewed or not found");
  try {
    change.targetId = await applyChange(change);
  } catch (error) {
    return refuse(res, error.status || 400, error.message || "Could not save this entry");
  }
  change.status = "approved";
  change.reviewedAt = new Date();
  await change.save();
  res.json(changeRow(change));
};

// POST /activity/pending/:id/reject { note } (owner)
const reject = async (req, res) => {
  const change = await findPending(req);
  if (!change) return refuse(res, 404, "Already reviewed or not found");
  change.status = "rejected";
  change.reviewNote = String(req.body?.note || "").trim();
  change.reviewedAt = new Date();
  await change.save();
  res.json(changeRow(change));
};

// POST /activity/pending/approve-all (owner): approves in the order sent; the ones that fail stay waiting
const approveAll = async (req, res) => {
  const changes = await PendingChange.find({ userId: req.userId, status: "pending" }).sort({ createdAt: 1 });
  let approved = 0;
  const failed = [];
  for (const change of changes) {
    try {
      // eslint-disable-next-line no-await-in-loop
      change.targetId = await applyChange(change);
      change.status = "approved";
      change.reviewedAt = new Date();
      // eslint-disable-next-line no-await-in-loop
      await change.save();
      approved += 1;
    } catch (error) {
      failed.push({ id: String(change._id), title: change.summary?.title, message: error.message });
    }
  }
  res.json({ approved, failed });
};

// GET /activity/mine?days= (staff): their entries (and the owner's when allowed), plus what they sent for approval
const mine = async (req, res) => {
  if (!req.staff) return refuse(res, 403, "Staff only");
  const period = periodOf(req.query);
  const own = { "createdBy.kind": "staff", "createdBy.id": String(req.staff._id) };
  const who = req.staff.seeOwnerEntries ? { $or: [own, { "createdBy.kind": { $ne: "staff" } }] } : own;
  const [rows, changes] = await Promise.all([
    savedEntries(req.userId, period, who),
    PendingChange.find({ userId: req.userId, staffId: req.staff._id, createdAt: { $gte: period.from, $lte: period.to }, status: { $ne: "approved" } })
      .sort({ createdAt: -1 }).lean(),
  ]);
  const staffId = String(req.staff._id);
  res.json({
    from: period.from,
    to: period.to,
    // Only their own entries come with the full record, to open for editing
    rows: rows.map(({ doc, ...row }) => ({ ...row, mine: row.by.kind === "staff" && row.by.id === staffId, doc: row.by.id === staffId ? doc : undefined })),
    changes: changes.map(changeRow),
  });
};

// DELETE /activity/pending/:id (staff): take back something still waiting
const withdraw = async (req, res) => {
  if (!req.staff) return refuse(res, 403, "Staff only");
  const change = await PendingChange.findOne({ _id: req.params.id, userId: req.userId, staffId: req.staff._id, status: "pending" });
  if (!change) return refuse(res, 404, "Already reviewed or not found");
  await change.deleteOne();
  res.json({ success: true });
};

// GET /activity/view/:entity/:id (owner): every field of a saved entry
const viewEntry = async (req, res) => {
  const handler = registry[req.params.entity];
  if (!handler) return refuse(res, 404, "Unknown entry");
  const doc = await handler.Model.findOne({ _id: req.params.id, userId: req.userId }).populate(handler.populate).lean().catch(() => null);
  if (!doc) return refuse(res, 404, "This entry has been deleted");
  const summary = await summarizer(req.params.entity)(doc, req.userId);
  res.json({
    entity: req.params.entity,
    title: summary.title,
    by: byOf(doc),
    createdAt: doc.createdAt,
    updatedBy: doc.updatedBy?.kind ? doc.updatedBy : null,
    updatedAt: doc.updatedBy?.kind ? doc.updatedAt : null,
    details: await detailsOf(req.params.entity, doc, req.userId),
  });
};

// A change's lines as it would save (totals worked out the way saving would; as sent if that no longer works),
// and for an edit the entry as it is now
const changeDetails = async (change, userId) => {
  const handler = registry[change.entity];
  const current = change.action === "update" && handler
    ? await handler.Model.findOne({ _id: change.targetId, userId }).lean().catch(() => null)
    : null;
  let after = change.data || {};
  if (handler) {
    try {
      const staff = await Staff.findById(change.staffId).lean();
      const fakeReq = { userId, staff: staff || { _id: change.staffId, name: change.staffName } };
      after = { ...(current || {}), ...(await handler.preview(fakeReq, change.data || {}, current)) };
    } catch {
      after = { ...(current || {}), ...(change.data || {}) };
    }
  }
  return {
    details: await detailsOf(change.entity, after, userId),
    beforeDetails: current ? await detailsOf(change.entity, current, userId) : null,
    targetMissing: change.action === "update" && !current,
  };
};

// GET /activity/pending/:id/view (owner): what a waiting (or reviewed) change holds
const viewChange = async (req, res) => {
  const change = await PendingChange.findOne({ _id: req.params.id, userId: req.userId }).lean();
  if (!change) return refuse(res, 404, "Not found");
  res.json({ ...changeRow(change), ...(await changeDetails(change, req.userId)) });
};

module.exports = { pending, reviewed, feed, approve, reject, approveAll, mine, withdraw, viewEntry, viewChange };
