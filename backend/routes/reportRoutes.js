const express = require("express");
const { profit, trend, balances, partyLedger } = require("../controllers/reportController");

// Reports: profit, monthly trend, party balances and ledgers
const router = express.Router();

router.get("/profit", profit);
router.get("/trend", trend);
router.get("/balances", balances);
router.get("/party-ledger/:id", partyLedger);

module.exports = router;
