const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Material, Staff } = require("../models");
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

// What a staff login is allowed to do, for the app to show only that
const sanitizeStaff = (staff) => ({
  id: staff._id,
  name: staff.name,
  mobile: staff.mobile,
  canAdd: staff.canAdd || {},
  editMode: Staff.editModeOf(staff),
  editDays: staff.editDays ?? 5,
  seeOwnerEntries: Boolean(staff.seeOwnerEntries),
  needsApproval: staff.needsApproval !== false,
});
// A staff login sees only the company's name, not the owner's account details
const companyOf = (user) => ({ id: user._id, name: user.name, companyName: user.companyName });

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

// Staff sign in with their mobile and password; the session belongs to the owner's account
const staffLogin = async (req, res) => {
  const mobile = String(req.body.mobile || "").replace(/\D/g, "").slice(-10);
  const staff = await Staff.findOne({ mobile }).select("+password");
  if (!staff || !(await bcrypt.compare(String(req.body.password || ""), staff.password))) {
    return res.status(400).json({ message: "Wrong mobile or password" });
  }
  if (!staff.isActive) return res.status(403).json({ message: "Your staff login is switched off. Ask the owner." });
  const owner = await User.findById(staff.userId);
  if (!owner) return res.status(400).json({ message: "This staff login's account no longer exists" });
  const token = jwt.sign({ id: owner._id, staffId: staff._id }, JWT_SECRET(), { expiresIn: "30d" });
  res.cookie(AUTH_COOKIE_NAME, token, { ...cookieOptions(), maxAge: 30 * 24 * 60 * 60 * 1000 });
  return res.json({ success: true, user: companyOf(owner), staff: sanitizeStaff(staff) });
};

const logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ success: true });
};

const me = async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ message: "Please sign in" });
  if (req.staff) return res.json({ user: companyOf(user), staff: sanitizeStaff(req.staff) });
  res.json({ user: sanitizeUser(user), staff: null });
};

// Profile and company details; a new password needs the current one
const updateMe = async (req, res) => {
  if (req.staff) return res.status(403).json({ message: "Only the owner can change the account" });
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

module.exports = { register, login, staffLogin, logout, me, updateMe };
