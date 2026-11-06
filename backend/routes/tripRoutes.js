const express = require("express");
const { Trip } = require("../models");
const crudRouter = require("../utils/crud");
const { crudOptions } = require("../controllers/tripController");

// Trips
const router = express.Router();

router.use("/", crudRouter(Trip, crudOptions));

module.exports = router;
