import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { personaRoutes } from "./routes/persona.routes.js";
import { recommendRoutes } from "./routes/recommend.routes.js";
import { reviewRoutes } from "./routes/review.routes.js";
import { chatRoutes } from "./routes/chat.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { agentRoutes } from "./routes/agent.routes.js";
import { nearbyRoutes } from "./routes/nearby.routes.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10kb" })); // prevent oversized payloads
app.use(requestId);
const ENDPOINTS = [
  "GET  /health",
  "POST /auth/signup",
  "POST /auth/signin",
  "POST /auth/refresh",
  "POST /auth/signout",
  "GET  /auth/me",
  "POST /auth/forgot-password",
  "POST /auth/reset-password",
  "GET  /auth/favorites",
  "POST /auth/favorites",
  "DELETE /auth/favorites/:restaurant_id",
  "GET  /nearby",
  "POST /agent",
  "POST /extract-persona",
  "POST /update-preference",
  "POST /recommend",
  "POST /generate-review",
  "POST /chat",
  "GET  /chat/:sessionId",
  "DELETE /chat/:sessionId",
];
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Slow down." } },
  })
);
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "NaijaTaste AI",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    endpoints: ENDPOINTS,
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/", authRoutes);
app.use("/", agentRoutes);
app.use("/", nearbyRoutes);
app.use("/", personaRoutes);
app.use("/", recommendRoutes);
app.use("/", reviewRoutes);
app.use("/", chatRoutes);
app.use(express.static('public'))

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "ROUTE_NOT_FOUND", message: `Route ${req.method} ${req.path} not found` },
    available_endpoints: ENDPOINTS,
    requestId: req.id,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);
