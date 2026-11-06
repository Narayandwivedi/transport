const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Material } = require("../models");
const { AUTH_COOKIE_NAME, JWT_SECRET } = require("../middleware/auth");

const DEFAULT_MATERIALS = ["Sand", "Gitti 10mm", "Gitti 20mm", "Gitti 40mm"];

const PROFILE_FIELDS = ["name", "companyName", "email", "mobile", "address", "gstin", "quotationTerms", "documentReminderDays"];

const sanitizeUser = (user) => ({
  id: user._id,
  ...Object.fromEntries(PROFILE_FIELDS.map((field) => [field, user[field]])),
});

const cookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};

const signIn = (res, user) => {
  const token = jwt.sign({ id: user._id }, JWT_SECRET(), { expiresIn: "7d" });
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
  return res.json({ success: true, user: sanitizeUser(user) });
};

// Sign in with an email (has "@") or a mobile number
const findByLogin = (login) => {
  const value = String(login || "").trim();
  return User.findOne(value.includes("@") ? { email: value.toLowerCase() } : { mobile: value });
};

const register = async (req, res) => {
  const { name, companyName, email, mobile, password } = req.body;
  if (!name || !password || (!email && !mobile)) {
    return res.status(400).json({ message: "Name, password and email or mobile are required" });
  }
  if (String(password).length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
  const exists = await User.findOne({ $or: [email ? { email: String(email).toLowerCase() } : null, mobile ? { mobile } : null].filter(Boolean) });
  if (exists) return res.status(400).json({ message: "An account with this email or mobile already exists" });
  const user = await User.create({
    name,
    companyName,
    email,
    mobile,
    password: await bcrypt.hash(String(password), 10),
    quotationTerms: "1. Rates are valid till the date mentioned.\n2. Loading and unloading by party.\n3. Toll and border tax extra unless mentioned.\n4. Payment within 15 days of bill.",
  });
  // A new account starts with the usual materials to supply on trips
  await Material.insertMany(DEFAULT_MATERIALS.map((materialName) => ({ userId: user._id, name: materialName })));
  signIn(res, user);
};

const login = async (req, res) => {
  const user = await findByLogin(req.body.login);
  if (!user || !(await bcrypt.compare(String(req.body.password || ""), user.password))) {
    return res.status(400).json({ message: "Wrong email / mobile or password" });
  }
  signIn(res, user);
};

const logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ success: true });
};

const me = async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ message: "Please sign in" });
  res.json({ user: sanitizeUser(user) });
};

// Profile and company details; a new password needs the current one
const updateMe = async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ message: "Please sign in" });
  PROFILE_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  });
  if (req.body.newPassword) {
    if (!(await bcrypt.compare(String(req.body.currentPassword || ""), user.password))) {
      return res.status(400).json({ message: "Current password is wrong" });
    }
    user.password = await bcrypt.hash(String(req.body.newPassword), 10);
  }
  await user.save();
  res.json({ user: sanitizeUser(user) });
};

module.exports = { register, login, logout, me, updateMe };
