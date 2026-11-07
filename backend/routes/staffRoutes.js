const express = require("express");
const { ownerOnly } = require("../middleware/auth");
const { list, create, update, remove } = require("../controllers/staffController");

// Staff logins, managed by the owner in Settings
const router = express.Router();

router.use(ownerOnly);
router.get("/", list);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

module.exports = router;
