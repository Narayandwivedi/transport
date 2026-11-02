const express = require("express");
const { dateFilter, nextNumber } = require("./common");

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  } = options;

  // Forms send "" for an empty date or an unpicked party / vehicle; store those as null
  const blanksToNull = (data) => {
    Object.keys(data).forEach((key) => {
      const type = Model.schema.path(key)?.instance;
      if (data[key] === "" && (type === "ObjectId" || type === "Date")) data[key] = null;
    });
    return data;
  };

  const findOwn = (req) => Model.findOne({ _id: req.params.id, userId: req.userId });

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
    const rows = await Model.find(query).sort(sort).populate(populate).lean();
    res.json(rows);
  });

  router.get("/:id", async (req, res) => {
    const doc = await findOwn(req).populate(populate).lean();
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  });

  router.post("/", async (req, res) => {
    const data = await prepare(req, blanksToNull({ ...req.body }), null);
    delete data._id;
    data.userId = req.userId;
    if (number && !data[number.field]) data[number.field] = await nextNumber(req.userId, number.key, number.prefix);
    const doc = await Model.create(data);
    await afterSave(req, doc, null);
    res.status(201).json(await Model.findById(doc._id).populate(populate).lean());
  });

  router.put("/:id", async (req, res) => {
    const doc = await findOwn(req);
    if (!doc) return res.status(404).json({ message: "Not found" });
    const blocked = canChange(doc);
    if (blocked) return res.status(400).json({ message: blocked });
    const old = doc.toObject();
    const data = await prepare(req, blanksToNull({ ...req.body }), old);
    delete data._id;
    delete data.userId;
    doc.set(data);
    await doc.save();
    await afterSave(req, doc, old);
    res.json(await Model.findById(doc._id).populate(populate).lean());
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

  return router;
};

module.exports = crudRouter;
