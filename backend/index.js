const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });

const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { auth } = require("./middleware/auth");
const authRoutes = require("./routes/authRoutes");
const apiRoutes = require("./routes");

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors({
  origin: (process.env.CLIENT_ORIGINS || "http://localhost:5180,http://localhost:5173").split(",").map((origin) => origin.trim()),
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.json({ message: "TransportBook backend is running" }));

app.use("/api/auth", authRoutes);
// Uploaded document scans are only shown to a signed-in user
app.use("/uploads", auth, express.static(path.join(__dirname, "uploads")));
app.use("/api", auth, apiRoutes);

// One readable message for every failure
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let message = error.message || "Something went wrong";
  if (error.name === "ValidationError") {
    status = 400;
    message = Object.values(error.errors).map((item) => item.message).join(", ");
  } else if (error.name === "CastError") {
    status = 400;
    message = `Wrong value for ${error.path}`;
  } else if (error.code === 11000) {
    status = 400;
    message = "This already exists (duplicate number)";
  }
  if (status >= 500) console.error(error);
  res.status(status).json({ message });
});

const start = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is missing in backend/.env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("MongoDB connected");
  app.listen(PORT, () => console.log(`TransportBook backend on http://localhost:${PORT}`));
};

if (require.main === module) {
  start().catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  });
}

module.exports = app;
