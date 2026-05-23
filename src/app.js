import "dotenv/config";
import express from "express";
import cors from "cors";
import { personaRoutes } from "./routes/persona.routes.js";
import { recommendRoutes } from "./routes/recommend.routes.js";
import { reviewRoutes } from "./routes/review.routes.js";
import { chatRoutes } from "./routes/chat.routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" })); // prevent oversized payloads
app.use(cors());
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "NaijaTaste AI",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: [
      "POST /extract-persona",
      "POST /update-preference",
      "POST /recommend",
      "POST /generate-review",
      "POST /chat",
      "GET  /chat/:sessionId",
      "DELETE /chat/:sessionId",
    ],
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/", personaRoutes);
app.use("/", recommendRoutes);
app.use("/", reviewRoutes);
app.use("/", chatRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    available_endpoints: [
      "GET  /health",
      "POST /extract-persona",
      "POST /update-preference",
      "POST /recommend",
      "POST /generate-review",
      "POST /chat",
      "GET  /chat/:sessionId",
      "DELETE /chat/:sessionId",
    ],
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║       NaijaTaste AI — Online         ║
║       Port: ${PORT}                     ║
║       DSN x BCT Hackathon 3.0        ║
╚══════════════════════════════════════╝
  `);
});
