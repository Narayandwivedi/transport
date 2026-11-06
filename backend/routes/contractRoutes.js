const express = require("express");
const { Contract } = require("../models");
const crudRouter = require("../utils/crud");
const { list, crudOptions } = require("../controllers/contractController");

// Monthly hire: vehicles hired in / given out on monthly rent
const router = express.Router();

// The list comes with each contract's status and rent; the rest is plain CRUD
router.get("/", list);
router.use("/", crudRouter(Contract, crudOptions));

module.exports = router;
