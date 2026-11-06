const fs = require("fs");
const path = require("path");
const { idOf } = require("../utils/common");
const { refuse, ownVehicle } = require("../utils/guards");
const reports = require("../utils/reports");

// Deletes an uploaded scan ("/uploads/…" under the backend folder)
const removeUpload = async (file) => {
  if (!file) return;
  await fs.promises.unlink(path.join(__dirname, "..", file)).catch(() => {});
};

// GET /documents: every document with its days left and status
const list = async (req, res) => {
  let docs = await reports.documentStatus(req.userId);
  if (req.query.vehicleId) docs = docs.filter((doc) => idOf(doc.vehicleId) === req.query.vehicleId);
  if (req.query.docType) docs = docs.filter((doc) => doc.docType === req.query.docType);
  res.json(docs);
};

// Vehicle documents: tax, insurance, fitness, PUC, GPS, permit…, with an optional scan
const crudOptions = {
  populate: "vehicleId",
  prepare: async (req, data, old) => {
    if (!(await ownVehicle(req, data.vehicleId))) throw refuse("Pick a vehicle");
    delete data.file;
    delete data.fileName;
    if (req.file) {
      data.file = `/uploads/${req.file.filename}`;
      data.fileName = req.file.originalname;
      if (old?.file) await removeUpload(old.file);
    } else if (req.body.removeFile === "true" && old?.file) {
      await removeUpload(old.file);
      data.file = "";
      data.fileName = "";
    }
    return data;
  },
  afterDelete: async (req, doc) => removeUpload(doc.file),
};

module.exports = { list, crudOptions };
