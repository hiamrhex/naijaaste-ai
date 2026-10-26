import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
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
import { jsonBody, JSON_BODY_LIMIT_BYTES } from "./middleware/jsonBody.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { fail } from "./lib/respond.js";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";
import { googleAuthEnabled } from "./auth/google.js";
import { readinessProbe } from "./lib/readiness.js";
import { clientIp } from "./lib/clientIp.js";
import { requireAuth } from "./auth/middleware.js";

export const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.set("trust proxy", env.TRUST_PROXY);
// Strict CSP minus style 'unsafe-inline': the SPA sets styles through React
// (CSSOM, allowed) but AuthGate injects one <style> element and Google Fonts
// ships a stylesheet — both need it. Scripts stay locked to self + GIS.
// connectSrc includes localhost only in development.
const connectSrc = ["'self'", "https://accounts.google.com", "https://commons.wikimedia.org"];
if (env.NODE_ENV === 'development') {
  connectSrc.push("http://localhost:3000");
}
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc,
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
// requestId first, then the body parser: a malformed or oversized body must
// still answer with the request id, and the parser must not run before the
// id exists.
app.use(requestId);
// Our own JSON parser instead of express.json(): body-parser assumes the
// request is a readable stream, which is not true on the Vercel runtime, and
// the resulting TypeError turned every POST-with-a-body into a 500 with no
// request id. See src/middleware/jsonBody.js.
app.use(jsonBody({ limit: JSON_BODY_LIMIT_BYTES }));

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
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
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
  "POST /api/v1/auth/saved-places",
  "DELETE /api/v1/auth/saved-places/:id",
  "GET  /api/v1/nearby",
  "GET  /api/v1/restaurants/geo",
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


// Key the limiters on the IP captured BEFORE the body was read. The default
// keyGenerator reads req.ip, which throws on the serverless runtime once the
// body has been consumed (the socket is null by then) - that turned every
// POST with a body into a 500. See src/lib/clientIp.js.
const keyByClientIp = (req) => {
  const ip = clientIp(req);
  if (!ip || ip === "unknown") return "unknown";
  try {
    return ipKeyGenerator(ip);
  } catch {
    return ip;
  }
};

// Single unified limiter: global + per-endpoint specific limits
// Uses skip function to apply different limits per route group
// Emits ONLY ONE set of RateLimit headers (draft-7) per response
const createLimiter = (windowMs, limit, skipPaths = []) => rateLimit({
  windowMs,
  limit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: keyByClientIp,
  skip: (req) => skipPaths.some(p => req.path === p || req.path.startsWith(p)),
  handler: (req, res) => fail(res, {
    status: 429,
    code: "RATE_LIMITED",
    message: "Too many requests, please try again later.",
    requestId: req.id,
    retryAfterSec: Math.ceil(windowMs / 1000),
  }),
});

// LLM endpoints: 10/min
const llmPaths = [
  "/chat", "/extract-persona", "/update-preference", "/recommend", "/generate-review", "/agent",
  "/api/v1/chat", "/api/v1/extract-persona", "/api/v1/update-preference", "/api/v1/recommend", "/api/v1/generate-review", "/api/v1/agent"
];

// Auth endpoints: per-flow limits (handled in auth.routes.js)
const authPaths = ["/auth/", "/api/v1/auth/"];

// Health: no limit
const healthPaths = ["/health", "/health/ready"];

// Global: 600/15min for everything else
const globalLimiter = createLimiter(15 * 60 * 1000, env.RATE_LIMIT_API_MAX, [
  ...healthPaths,
  ...authPaths,
  ...llmPaths
]);

// LLM limiter: 10/min
const llmLimiter = createLimiter(60 * 1000, env.RATE_LIMIT_LLM_MAX, []);

// Apply limiters in order: global first (catches everything), then LLM (overrides for LLM paths)
// CRITICAL: Only ONE limiter runs per request to avoid stacked RateLimit headers
app.use((req, res, next) => {
  // Check if this is an LLM path
  const isLlmPath = llmPaths.some(p => req.path === p || req.path.startsWith(p));
  if (isLlmPath) {
    return llmLimiter(req, res, next);
  }
  // Check if this is an auth/health path (skip global)
  const isSkippedGlobal = [...healthPaths, ...authPaths].some(p => req.path === p || req.path.startsWith(p));
  if (isSkippedGlobal) {
    return next();
  }
  // Everything else: global limiter
  return globalLimiter(req, res, next);
});

// Metrics endpoint for SLO aggregation - requires authentication
app.get('/metrics', requireAuth, async (req, res) => {
  // Mock Prometheus metrics for now - in production this would query actual metrics
  const metrics = `# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status=200} 42
http_requests_total{method="POST",status=200} 28
http_requests_total{method="GET",status=404} 5

# HELP http_request_duration_ms HTTP request duration in milliseconds
# TYPE http_request_duration_ms histogram
http_request_duration_ms_bucket{le="100"} 65
http_request_duration_ms_bucket{le="1000"} 70
http_request_duration_ms_bucket{le="10000"} 70
http_request_duration_ms_bucket{le="+Inf"} 70
http_request_duration_ms_sum 5432
http_request_duration_ms_count 70

# HELP llm_calls_total Total LLM API calls
# TYPE llm_calls_total counter
llm_calls_total{model="gemini-3.5-flash-lite"} 156
llm_calls_total{model="gemini-3.5-flash"} 89
llm_calls_total{model="gemini-3.6-flash"} 67
`;

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

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
