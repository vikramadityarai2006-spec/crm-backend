require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

app.use("/api/auth",       require("./routes/auth"));
app.use("/api/candidates", require("./routes/candidates"));
app.use("/api/masters",    require("./routes/masters"));
app.use("/api/users",      require("./routes/users"));
app.use("/api/audit",      require("./routes/audit"));
app.use("/api/dashboard",  require("./routes/dashboard"));

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Ample Leap CRM API", version: "5.0.0" });
});

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: err.message });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`✅ CRM running on port ${PORT}`));
}
