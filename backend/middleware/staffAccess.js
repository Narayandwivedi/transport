/**
 * What a staff login may reach under /api. The owner is never limited here.
 * Staff get: the entries the owner let them add (and their own entries back), the lists the entry
 * forms need (vehicles, parties, materials, drivers), adding a new party / material from a form,
 * and their own side of the Activity Center. Reports, dashboard, settings, deleting: owner only.
 */

const deny = (res, message = "Only the owner can see this.") => res.status(403).json({ message });

// Entry routes and which "can add" switch each needs; payments depend on received / paid
const ENTRY_ROUTES = {
  trips: () => "trip",
  "diesel-entries": () => "diesel",
  payments: (req) => (req.body?.type === "paid" ? "paid" : "received"),
  "meter-readings": () => "reading",
  expenses: () => "expense",
};

// Lists the entry forms read
const READ_ONLY = ["vehicles", "parties", "materials", "expense-categories"];
// Masters a form can add on the spot ("New Party", "New Material")
const ADD_FROM_FORM = ["parties", "materials"];

const staffAccess = (req, res, next) => {
  const staff = req.staff;
  if (!staff) return next();
  const [first = "", second = ""] = req.path.split("/").filter(Boolean);

  // Their own side of the Activity Center; the controller checks each action
  if (first === "activity") return next();

  // Drivers for the trip form, and nothing else from payroll
  if (first === "payroll") {
    return second === "employees" && req.method === "GET" && req.query.role === "driver" ? next() : deny(res);
  }

  const entry = ENTRY_ROUTES[first];
  if (entry) {
    if (req.method === "GET") return next();
    if (req.method === "POST") {
      return staff.canAdd?.[entry(req)] !== false ? next() : deny(res, "You are not allowed to add this entry.");
    }
    if (req.method === "PUT") {
      const { Staff } = require("../models");
      if (Staff.editModeOf(staff) === "none") return deny(res, "You are not allowed to change entries.");
      return staff.canAdd?.[entry(req)] !== false ? next() : deny(res, "You are not allowed to change this entry.");
    }
    return deny(res, "Only the owner can delete entries.");
  }

  if (READ_ONLY.includes(first) && req.method === "GET") return next();
  if (ADD_FROM_FORM.includes(first) && req.method === "POST" && !second) return next();
  return deny(res);
};

module.exports = { staffAccess };
