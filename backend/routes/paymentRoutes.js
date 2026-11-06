const express = require("express");
const { Payment } = require("../models");
const crudRouter = require("../utils/crud");
const { crudOptions } = require("../controllers/paymentController");

// Payments received / paid
const router = express.Router();

router.use("/", crudRouter(Payment, crudOptions));

module.exports = router;
