const express = require("express");
const { Party } = require("../models");
const crudRouter = require("../utils/crud");
const { crudOptions } = require("../controllers/partyController");

// Parties: customers, vehicle owners, suppliers, petrol pumps
const router = express.Router();

router.use("/", crudRouter(Party, crudOptions));

module.exports = router;
