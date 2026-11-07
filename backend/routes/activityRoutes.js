const express = require("express");
const { ownerOnly } = require("../middleware/auth");
const { pending, reviewed, feed, approve, reject, approveAll, mine, withdraw, viewEntry, viewChange } = require("../controllers/activityController");

// Activity Center: the owner approves staff entries and sees who added what; staff see their own
const router = express.Router();

router.get("/mine", mine);
router.delete("/pending/:id", withdraw);

router.get("/pending", ownerOnly, pending);
router.get("/reviewed", ownerOnly, reviewed);
router.get("/feed", ownerOnly, feed);
router.get("/view/:entity/:id", ownerOnly, viewEntry);
router.get("/pending/:id/view", ownerOnly, viewChange);
router.post("/pending/approve-all", ownerOnly, approveAll);
router.post("/pending/:id/approve", ownerOnly, approve);
router.post("/pending/:id/reject", ownerOnly, reject);

module.exports = router;
