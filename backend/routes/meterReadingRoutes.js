const express = require("express");
const { MeterReading } = require("../models");
const crudRouter = require("../utils/crud");
const { crudOptions } = require("../controllers/meterReadingController");

// Meter readings
const router = express.Router();

router.use("/", crudRouter(MeterReading, crudOptions));

module.exports = router;
