const express = require("express");
const { profit, trend, balances, partyLedger, mileage } = require("../controllers/reportController");

// Reports: profit, monthly trend, party balances and ledgers, mileage
const router = express.Router();

router.get("/profit", profit);
router.get("/trend", trend);
router.get("/balances", balances);
router.get("/party-ledger/:id", partyLedger);
// Long-term mileage of each vehicle from its meter readings and diesel
router.get("/mileage", mileage);

module.exports = router;
