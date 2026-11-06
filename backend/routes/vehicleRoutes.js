const express = require("express");
const { Vehicle } = require("../models");
const crudRouter = require("../utils/crud");
const { crudOptions } = require("../controllers/vehicleController");

// Vehicles: my own and hired
const router = express.Router();

router.use("/", crudRouter(Vehicle, crudOptions));

module.exports = router;
