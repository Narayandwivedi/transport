const express = require("express");
const { dateFilter, nextNumber, dayNum, todayNum } = require("./common");
const { actorOf } = require("../middleware/auth");

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Fields a form may never set itself
const SYSTEM_FIELDS = ["_id", "userId", "createdBy", "updatedBy", "createdAt", "updatedAt", "__v"];
const stripSystem = (data) => {
  SYSTEM_FIELDS.forEach((field) => delete data[field]);
  return data;
};
const copy = (data) => JSON.parse(JSON.stringify(data));

/**
 * Entry kinds staff can add (trip, diesel, payment, reading, expense), so the Activity Center can
 * save an approved change exactly the way the form would have: { Model, populate, create, update }.
 */
const registry = {};

/**
 * List / get / add / change / delete routes for one model, always limited to the signed-in account.
 * options:
 *  populate, sort          how lists come back
 *  dateField               ?from=&to= filter on this field
 *  filters                 query params copied straight into the filter (vehicleId, partyId, type…)
 *  searchFields            ?search= matches any of these
 *  number                  { field, key, prefix } auto number for new records
 *  prepare(req, data, old) clean / calculate fields before saving; throw { status, message } to refuse
 *  afterSave(req, doc, old), afterDelete(req, doc)  keep linked records in step
 *  canChange(doc)          a message when the record may not be edited / deleted on its own
 *  beforeDelete(req, doc)  a message when other records still use it
 *  entity                  an entry staff can add: staff see only their own (and the owner's when allowed),
 *                          change only their own, and with "save on approval" it waits for the owner
 *  summarize(doc, userId)  { date, title, detail, amount } of an entry, for the Activity Center
 */
const crudRouter = (Model, options = {}) => {
  const router = express.Router();
  const {
    populate = "",
    sort = { createdAt: -1 },
    dateField = "",
    filters = [],
    searchFields = [],
    number = null,
    prepare = async (req, data) => data,
    afterSave = async () => {},
    afterDelete = async () => {},
    canChange = () => "",
    beforeDelete = async () => "",
    entity = "",
    summarize = null,
  } = options;

  // Forms send "" for an empty date or an unpicked party / vehicle; store those as null
  const blanksToNull = (data) => {
    Object.keys(data).forEach((key) => {
      const type = Model.schema.path(key)?.instance;
      if (data[key] === "" && (type === "ObjectId" || type === "Date")) data[key] = null;
    });
    return data;
  };

  // A staff login sees its own entries, plus the owner's when the owner allowed it (older entries count as the owner's)
  const visibleTo = (req) => {
    if (!req.staff || !entity) return null;
    const own = { "createdBy.kind": "staff", "createdBy.id": String(req.staff._id) };
    return req.staff.seeOwnerEntries ? { $or: [own, { "createdBy.kind": { $ne: "staff" } }] } : own;
  };
  const isOwnStaffEntry = (req, doc) => doc.createdBy?.kind === "staff" && doc.createdBy?.id === String(req.staff._id);

  const findOwn = (req) => {
    const query = { _id: req.params.id, userId: req.userId };
    const visible = visibleTo(req);
    if (visible) query.$and = [visible];
    return Model.findOne(query);
  };

  // Saves a new record; actor is who it is "added by"
  const createDoc = async (req, body, actor = actorOf(req)) => {
    const data = stripSystem(await prepare(req, body, null));
    data.userId = req.userId;
    data.createdBy = actor;
    if (number && !data[number.field]) data[number.field] = await nextNumber(req.userId, number.key, number.prefix);
    const doc = await Model.create(data);
    await afterSave(req, doc, null);
    return doc;
  };

  // Saves changes to a record
  const updateDoc = async (req, doc, body, actor = actorOf(req)) => {
    const old = doc.toObject();
    const data = stripSystem(await prepare(req, body, old));
    doc.set(data);
    doc.updatedBy = actor;
    await doc.save();
    await afterSave(req, doc, old);
    return doc;
  };

  const populated = (id) => Model.findById(id).populate(populate).lean();

  // A staff edit waits for approval when the login's edit mode says so (older entries only, for "request_after_days")
  const editNeedsApproval = (req, doc) => {
    const { Staff } = require("../models");
    const mode = Staff.editModeOf(req.staff);
    if (mode === "request") return true;
    if (mode !== "request_after_days") return false;
    const when = (dateField && doc[dateField]) || doc.createdAt;
    const ageDays = todayNum() - dayNum(when);
    return ageDays > Number(req.staff.editDays ?? 5);
  };

  // Staff with "save on approval": check the form now, then keep it for the owner instead of saving
  const holdForApproval = async (req, res, action, body, doc = null) => {
    const { PendingChange } = require("../models");
    const old = doc ? doc.toObject() : null;
    const preview = await prepare(req, copy(body), old);
    const describe = summarize || (() => ({}));
    const change = await PendingChange.create({
      userId: req.userId,
      staffId: req.staff._id,
      staffName: req.staff.name,
      entity,
      action,
      targetId: doc ? doc._id : null,
      data: body,
      summary: await describe({ ...(old || {}), ...preview }, req.userId),
      before: old ? await describe(old, req.userId) : undefined,
    });
    return res.status(202).json({ pendingApproval: true, pendingId: change._id, message: "Sent to the owner for approval" });
  };

  router.get("/", async (req, res) => {
    const query = { userId: req.userId };
    filters.forEach((field) => {
      if (req.query[field]) query[field] = req.query[field];
    });
    if (dateField) Object.assign(query, dateFilter(dateField, req.query.from, req.query.to));
    if (req.query.search && searchFields.length) {
      const pattern = new RegExp(escapeRegex(req.query.search), "i");
      query.$or = searchFields.map((field) => ({ [field]: pattern }));
    }
    const visible = visibleTo(req);
    if (visible) query.$and = [visible];
    const rows = await Model.find(query).sort(sort).populate(populate).lean();
    res.json(rows);
  });

  router.get("/:id", async (req, res) => {
    const doc = await findOwn(req).populate(populate).lean();
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  });

  router.post("/", async (req, res) => {
    const body = stripSystem(blanksToNull({ ...req.body }));
    if (req.staff && entity && req.staff.needsApproval) return holdForApproval(req, res, "create", body);
    const doc = await createDoc(req, body);
    res.status(201).json(await populated(doc._id));
  });

  router.put("/:id", async (req, res) => {
    const doc = await findOwn(req);
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (req.staff && entity && !isOwnStaffEntry(req, doc)) return res.status(403).json({ message: "You can change only the entries you added." });
    const blocked = canChange(doc);
    if (blocked) return res.status(400).json({ message: blocked });
    const body = stripSystem(blanksToNull({ ...req.body }));
    if (req.staff && entity && editNeedsApproval(req, doc)) return holdForApproval(req, res, "update", body, doc);
    await updateDoc(req, doc, body);
    res.json(await populated(doc._id));
  });

  router.delete("/:id", async (req, res) => {
    const doc = await findOwn(req);
    if (!doc) return res.status(404).json({ message: "Not found" });
    const blocked = canChange(doc) || (await beforeDelete(req, doc));
    if (blocked) return res.status(400).json({ message: blocked });
    await doc.deleteOne();
    await afterDelete(req, doc);
    res.json({ success: true });
  });

  // preview: the form data with its totals worked out, without saving (for the Activity Center's View)
  const preview = (req, body, old = null) => prepare(req, copy(body), old);
  if (entity) registry[entity] = { Model, populate, createDoc, updateDoc, summarize, preview };

  return router;
};

module.exports = crudRouter;
module.exports.registry = registry;
