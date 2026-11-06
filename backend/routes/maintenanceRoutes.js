const express = require("express");
const { Maintenance } = require("../models");
const crudRouter = require("../utils/crud");
const { list, markDone, crudOptions } = require("../controllers/maintenanceController");

// Maintenance schedules
const router = express.Router();

router.get("/", list);
router.post("/:id/done", markDone);
router.use("/", crudRouter(Maintenance, crudOptions));

module.exports = router;
