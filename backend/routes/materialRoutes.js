const express = require("express");
const { Material } = require("../models");
const crudRouter = require("../utils/crud");
const { crudOptions } = require("../controllers/materialController");

// Materials I supply on trips
const router = express.Router();

router.use("/", crudRouter(Material, crudOptions));

module.exports = router;
