const express = require("express");
const { profit, trend, balances, partyLedger, mileage, dieselReport, tripReport, expenseReport, punctureReport } = require("../controllers/reportController");

// Reports: profit, monthly trend, party balances and ledgers, mileage
const router = express.Router();

router.get("/profit", profit);
router.get("/trend", trend);
router.get("/balances", balances);
router.get("/party-ledger/:id", partyLedger);
// Long-term mileage of each vehicle from its meter readings and diesel
router.get("/mileage", mileage);
// Reports page: diesel by vehicle and pump, trips by vehicle and party, expenses by type and vehicle
router.get("/diesel", dieselReport);
router.get("/trips", tripReport);
router.get("/expenses", expenseReport);
// Tyre puncture history: each puncture with its trip, and the total spent
router.get("/punctures", punctureReport);

module.exports = router;
