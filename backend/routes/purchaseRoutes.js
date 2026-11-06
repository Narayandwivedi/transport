const express = require("express");
const { Purchase } = require("../models");
const crudRouter = require("../utils/crud");
const { crudOptions } = require("../controllers/purchaseController");

// Purchase bills: stock items bought from a supplier
const router = express.Router();

router.use("/", crudRouter(Purchase, crudOptions));

module.exports = router;
