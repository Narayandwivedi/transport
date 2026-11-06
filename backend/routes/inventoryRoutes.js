const express = require("express");
const { InventoryItem, InventoryTxn } = require("../models");
const crudRouter = require("../utils/crud");
const { itemCrudOptions, txnCrudOptions } = require("../controllers/inventoryController");

// Inventory: stock items, and stock in / out
const router = express.Router();

router.use("/items", crudRouter(InventoryItem, itemCrudOptions));
router.use("/txns", crudRouter(InventoryTxn, txnCrudOptions));

module.exports = router;
