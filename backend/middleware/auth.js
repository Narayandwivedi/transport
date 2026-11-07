const jwt = require("jsonwebtoken");

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "tb_token";
const JWT_SECRET = () => process.env.JWT_SECRET || "change_this_transport_secret";

/**
 * Signed in as the owner ({ id }) or as one of their staff ({ id: owner, staffId }).
 * req.userId is always the owner's account, so every list stays limited to it;
 * req.staff is the staff login (with its switches) when a staff member is signed in.
 */
const auth = async (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME] || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Please sign in" });
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET());
  } catch (error) {
    return res.status(401).json({ message: error.name === "TokenExpiredError" ? "Session expired, sign in again" : "Please sign in" });
  }
  req.userId = decoded.id;
  req.staff = null;
  if (decoded.staffId) {
    // Loaded here so a switch the owner changes applies at once, and a removed login stops working
    const { Staff } = require("../models");
    const staff = await Staff.findOne({ _id: decoded.staffId, userId: decoded.id }).lean();
    if (!staff || !staff.isActive) return res.status(401).json({ message: "Your staff login is switched off. Ask the owner." });
    req.staff = staff;
  }
  next();
};

// Who is making this request, for "added by" on entries
const actorOf = (req) => (req.staff
  ? { kind: "staff", id: String(req.staff._id), name: req.staff.name }
  : { kind: "owner", id: String(req.userId), name: "Owner" });

// Owner-only routes
const ownerOnly = (req, res, next) => (req.staff ? res.status(403).json({ message: "Only the owner can do this." }) : next());

module.exports = { auth, actorOf, ownerOnly, AUTH_COOKIE_NAME, JWT_SECRET };
