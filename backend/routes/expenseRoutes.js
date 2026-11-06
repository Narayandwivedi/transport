const express = require("express");
const { Expense } = require("../models");
const crudRouter = require("../utils/crud");
const { crudOptions } = require("../controllers/expenseController");

// Expenses on a vehicle or for the office
const router = express.Router();

router.use("/", crudRouter(Expense, crudOptions));

module.exports = router;
