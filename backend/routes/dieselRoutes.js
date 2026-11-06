const express = require("express");
const { DieselEntry } = require("../models");
const crudRouter = require("../utils/crud");
const { crudOptions } = require("../controllers/dieselController");

// Diesel purchases at petrol pumps
const router = express.Router();

router.use("/", crudRouter(DieselEntry, crudOptions));

module.exports = router;
