const express = require("express");
const { auth } = require("../middleware/auth");
const { register, login, staffLogin, logout, me, updateMe } = require("../controllers/authController");

// Sign up, sign in / out, and the signed-in user's profile
const router = express.Router();

router.post("/register", register);
router.post("/login", login);
// Staff sign in with mobile + password; they get only the add buttons and their own entries
router.post("/staff-login", staffLogin);
router.post("/logout", logout);
router.get("/me", auth, me);
router.put("/me", auth, updateMe);

module.exports = router;
