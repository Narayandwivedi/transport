const express = require("express");
const { Quotation } = require("../models");
const crudRouter = require("../utils/crud");
const { crudOptions } = require("../controllers/quotationController");

// Quotations
const router = express.Router();

router.use("/", crudRouter(Quotation, crudOptions));

module.exports = router;
