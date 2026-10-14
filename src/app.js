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
import { ratingsRoutes } from "./routes/ratings.routes.js";
import { reportsRoutes } from "./routes/reports.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { agentRoutes } from "./routes/agent.routes.js";
import { nearbyRoutes } from "./routes/nearby.routes.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { fail } from "./lib/respond.js";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";
import { googleAuthEnabled } from "./auth/google.js";
import { readinessProbe } from "./lib/readiness.js";

export const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.set("trust proxy", env.TRUST_PROXY);
// Strict CSP minus style 'unsafe-inline': the SPA sets styles through React
// (CSSOM, allowed) but AuthGate injects one <style> element and Google Fonts
// ships a stylesheet — both need it. Scripts stay locked to self + GIS.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:3000", "https://accounts.google.com"],
      frameSrc: ["https://accounts.google.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // would break GIS/tiles without COOP/COEP pairing
}));
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
// Layer 25 — canonical base path is /api/v1. Health stays unversioned
// (probes must not break across versions).
const ENDPOINTS = [
  "GET  /health",
  "GET  /health/ready",
  "POST /api/v1/auth/signup",
  "POST /api/v1/auth/signin",
  "POST /api/v1/auth/refresh",
  "POST /api/v1/auth/signout",
  "GET  /api/v1/auth/me",
  "DELETE /api/v1/auth/me",
  "POST /api/v1/auth/google",
  "POST /api/v1/auth/forgot-password",
  "POST /api/v1/auth/reset-password",
  "GET  /api/v1/auth/favorites",
  "POST /api/v1/auth/favorites",
  "DELETE /api/v1/auth/favorites/:restaurant_id",
  "GET  /api/v1/nearby",
  "POST /api/v1/agent",
  "POST /api/v1/extract-persona",
  "POST /api/v1/update-preference",
  "POST /api/v1/recommend",
  "POST /api/v1/generate-review",
  "POST /api/v1/chat",
  "GET  /api/v1/chat/:sessionId",
  "DELETE /api/v1/chat/:sessionId",
  "POST /api/v1/ratings",
  "GET  /api/v1/ratings",
  "POST /api/v1/reports",
  "GET  /api/v1/admin/stats",
  "GET  /api/v1/admin/reports",
  "PATCH /api/v1/admin/reports/:ticket",
];
// Layer 20 — the unified failure shape lives in lib/respond.js.
const limiterHandler = (windowSec) => (req, res) => {
  fail(res, {
    status: 429,
    code: "RATE_LIMITED",
    message: "Too many requests, please try again later.",
    requestId: req.id,
    retryAfterSec: windowSec,
  });
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_API_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.path === "/health" || req.path === "/health/ready", // probes never throttled
  handler: limiterHandler(900),
});

const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.RATE_LIMIT_LLM_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: limiterHandler(60),
});

app.use(apiLimiter);
app.use(
  ["/chat", "/extract-persona", "/update-preference", "/recommend", "/generate-review", "/agent",
   "/api/v1/chat", "/api/v1/extract-persona", "/api/v1/update-preference", "/api/v1/recommend", "/api/v1/generate-review", "/api/v1/agent"],
  llmLimiter
);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "NaijaTaste AI",
    version: "2.0.0",
    api: "/api/v1",
    timestamp: new Date().toISOString(),
    features: { google_auth: googleAuthEnabled() },
    endpoints: ENDPOINTS,
  });
});

// Readiness: probes the DB (bounded 2s) — 503 while the database is down so
// orchestrators/deploy gates can act; liveness (/health) stays independent.
app.get("/health/ready", async (_req, res) => {
  const { ready, db } = await readinessProbe();
  res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "unavailable",
    service: "NaijaTaste AI",
    ready,
    db,
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
// Canonical: /api/v1. Legacy unprefixed mounts stay until clients migrate
// (tracked in LAYERS.md layer 25); both serve identical handlers.
for (const base of ["/api/v1", "/"]) {
  app.use(base, authRoutes);
  app.use(base, agentRoutes);
  app.use(base, nearbyRoutes);
  app.use(base, personaRoutes);
  app.use(base, recommendRoutes);
  app.use(base, reviewRoutes);
  app.use(base, chatRoutes);
  app.use(base, ratingsRoutes);
  app.use(base, reportsRoutes);
  app.use(base, adminRoutes);
}
app.use(express.static('public'))

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  fail(res, {
    status: 404,
    code: "ROUTE_NOT_FOUND",
    message: `Route ${req.method} ${req.path} not found`,
    requestId: req.id,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);
