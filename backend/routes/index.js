const express = require("express");
const { categories } = require("../controllers/expenseController");
const { alerts, dashboard } = require("../controllers/reportController");
const { staffAccess } = require("../middleware/staffAccess");

// Every signed-in API route, mounted under /api
const router = express.Router();

// A staff login reaches only what the owner allowed (see middleware/staffAccess.js)
router.use(staffAccess);

router.use("/parties", require("./partyRoutes"));
router.use("/vehicles", require("./vehicleRoutes"));
router.use("/materials", require("./materialRoutes"));
router.use("/trips", require("./tripRoutes"));
router.use("/contracts", require("./contractRoutes"));
router.use("/payments", require("./paymentRoutes"));
router.use("/expenses", require("./expenseRoutes"));
router.get("/expense-categories", categories);
router.use("/inventory", require("./inventoryRoutes"));
router.use("/purchases", require("./purchaseRoutes"));
router.use("/diesel-entries", require("./dieselRoutes"));
router.use("/meter-readings", require("./meterReadingRoutes"));
router.use("/maintenance", require("./maintenanceRoutes"));
router.use("/documents", require("./documentRoutes"));
router.use("/quotations", require("./quotationRoutes"));
router.use("/payroll", require("./payrollRoutes"));
router.use("/reports", require("./reportRoutes"));
router.use("/staff", require("./staffRoutes"));
router.use("/activity", require("./activityRoutes"));
router.get("/alerts", alerts);
router.get("/dashboard", dashboard);

module.exports = router;
