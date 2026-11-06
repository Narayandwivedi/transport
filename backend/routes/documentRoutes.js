const express = require("express");
const { Document } = require("../models");
const crudRouter = require("../utils/crud");
const upload = require("../config/upload");
const { list, crudOptions } = require("../controllers/documentController");

// Vehicle documents, with an optional scanned file
const router = express.Router();

router.get("/", list);
router.use("/", upload.single("file"), crudRouter(Document, crudOptions));

module.exports = router;
