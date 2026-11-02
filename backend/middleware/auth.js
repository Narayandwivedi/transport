const jwt = require("jsonwebtoken");

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "tb_token";
const JWT_SECRET = () => process.env.JWT_SECRET || "change_this_transport_secret";

const auth = (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME] || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Please sign in" });
  try {
    req.userId = jwt.verify(token, JWT_SECRET()).id;
    next();
  } catch (error) {
    res.status(401).json({ message: error.name === "TokenExpiredError" ? "Session expired, sign in again" : "Please sign in" });
  }
};

module.exports = { auth, AUTH_COOKIE_NAME, JWT_SECRET };
