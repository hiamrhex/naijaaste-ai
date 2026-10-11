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
import { env } from "./env.js";
import { logger } from "./lib/logger.js";

export const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.set("trust proxy", env.TRUST_PROXY);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "10kb" })); // prevent oversized payloads
app.use(requestId);

// CORS allowlist — unset = open (reflect any origin), loudly logged (parity
// until the operator sets CORS_ORIGIN in production)
const allowedOrigins = (env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  logger.warn("CORS_ORIGIN not set — allowing requests from any origin");
}

app.use(
  cors({
    origin: allowedOrigins.length === 0 ? true : allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id", "RateLimit"],
  })
);
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
const limiterHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many requests, please try again later." },
    requestId: req.id,
  });
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_API_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.path === "/health", // probes never throttled
  handler: limiterHandler,
});

const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.RATE_LIMIT_LLM_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: limiterHandler,
});

app.use(apiLimiter);
app.use(
  ["/chat", "/extract-persona", "/update-preference", "/recommend", "/generate-review", "/agent"],
  llmLimiter
);

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
