const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/database_connection");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

app.disable("x-powered-by");

// --------------------
// CORS Configuration
// --------------------
const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  "http://localhost:5173"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header
      // (for example, server-to-server requests)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error("Origin is not allowed by CORS");
      error.statusCode = 403;

      return callback(error);
    },

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],

    maxAge: 600,
  })
);

// --------------------
// Security Headers
// --------------------
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  next();
});

// --------------------
// Body Parser
// --------------------
app.use(express.json({ limit: "1mb" }));

// --------------------
// Health Check
// --------------------
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Job Search Assistant API is running",
    data: {
      status: "ok",
    },
  });
});

// --------------------
// API Routes
// --------------------
app.use("/api/auth", require("./routes/authRoutes"));

app.use("/api/jobs", require("./routes/jobRoutes"));

app.use("/api/saved-jobs", require("./routes/savedJobRoutes"));

app.use("/api/savedJobs", require("./routes/savedJobRoutes"));

app.use("/api/applications", require("./routes/applicationRoutes"));

app.use("/api/profile", require("./routes/profileRoutes"));

app.use("/api/resume", require("./routes/resumeRoutes"));

app.use("/api/dashboard", require("./routes/dashboardRoutes"));

app.use("/api/companies", require("./routes/companyRoutes"));

app.use("/api/gmail", require("./routes/gmailRoutes"));

app.use("/api/notifications", require("./routes/notificationRoutes"));

app.use("/api/auto-apply", require("./routes/autoApplyRoutes"));

// --------------------
// Error Handling
// --------------------
app.use(notFound);
app.use(errorHandler);

// --------------------
// Server
// --------------------
const PORT = Number(process.env.PORT) || 7000;

async function start() {
  await connectDB();

  require("./services/autoApply/autoApplyScheduler").startAutoApplyRuntime();

  return app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = {
  app,
  start,
};
