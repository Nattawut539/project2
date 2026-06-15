const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
// Ensure a consistent JWT secret fallback across all modules during local development
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_for_local';
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(cors({ origin: FRONTEND, credentials: true }));
app.use(express.json());
app.use(cookieParser());


// === Auth / user login ===
app.use("/api/users", require("./routes/(userlogin)/register"));
app.use("/api/users", require("./routes/(userlogin)/userlogin"));
app.use("/api/users", require("./routes/(userlogin)/password"));
app.use("/api", require("./routes/(userlogin)/google"));
app.use("/api", require("./routes/(userlogin)/line"));
app.use("/api/provinces", require("./routes/provinces"));

// === Core APIs ===
app.use("/api", require("./routes/users"));
app.use("/api", require("./routes/queue"));
app.use("/api", require("./routes/measurements"));
app.use("/api", require("./routes/medical"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/calendar", require("./routes/calendar"));
app.use("/api", require("./routes/feedbacks"));
app.use("/api", require("./routes/help"));
app.use("/api/slots", require("./routes/slots"));


app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // ✅ ให้เบราว์เซอร์เข้าถึงไฟล์ได้
app.get("/", (_req, res) => res.send("Clinic API is running"));

app.listen(PORT, () => console.log(`✅ Server is running on port ${PORT}`));
