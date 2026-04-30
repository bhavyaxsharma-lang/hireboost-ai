import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import router from "./routes";
import webhookRouter from "./routes/webhook";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the Replit reverse proxy so express sees the real protocol (HTTPS)
// This is required for secure cookies to work in production
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const isProduction = process.env.NODE_ENV === "production";

// Build the set of origins that are permitted to make state-changing requests.
//
// In production the frontend is served from the same domain as the API
// (same-origin deployment). A legitimate same-origin browser request does NOT
// carry an Origin header, so it always passes the check below. An attacker
// hosting a cross-site form or script will trigger the browser to attach an
// Origin header pointing to the attacker's domain, which will not be in this
// set and will be rejected with 403.
//
// REPLIT_DEV_DOMAIN is present in both dev and prod environments, so we must
// check NODE_ENV first.
const allowedOriginsSet = new Set<string>();
if (process.env.ALLOWED_ORIGIN) {
  // Explicit override always wins (e.g. custom domain cross-origin setups).
  // Strip trailing slash to avoid allowlist mismatches (Origin headers never
  // include a trailing slash per spec).
  allowedOriginsSet.add(process.env.ALLOWED_ORIGIN.replace(/\/$/, ""));
} else if (isProduction) {
  // REPLIT_DOMAINS is a comma-separated list of production domain names
  // provided by the Replit platform (e.g. "my-app.replit.app,custom.com").
  if (process.env.REPLIT_DOMAINS) {
    for (const d of process.env.REPLIT_DOMAINS.split(",")) {
      const trimmed = d.trim();
      if (trimmed) allowedOriginsSet.add(`https://${trimmed}`);
    }
  }
  // Fail fast at startup in production if no origins could be resolved.
  // An empty allowlist would reject every state-changing request that carries
  // an Origin header — including the legitimate frontend — making the app
  // unusable. Crash loudly so the misconfiguration is caught during deployment
  // rather than surfacing as silent 403s at runtime.
  if (allowedOriginsSet.size === 0) {
    throw new Error(
      "Production origin allowlist is empty. " +
      "Set REPLIT_DOMAINS (provided by the Replit platform) or ALLOWED_ORIGIN " +
      "to configure trusted origins before starting the server."
    );
  }
} else {
  // Development: use the Replit dev domain so the Vite dev server can reach the API.
  if (process.env.REPLIT_DEV_DOMAIN) {
    allowedOriginsSet.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  } else {
    allowedOriginsSet.add("http://localhost:5173");
  }
}

// Use the first entry as the single CORS origin (browsers require one explicit
// value when credentials are included).
const allowedOrigin = allowedOriginsSet.size > 0 ? [...allowedOriginsSet][0] : null;

if (allowedOrigin) {
  app.use(cors({ origin: allowedOrigin, credentials: true }));
}

// Defense-in-depth: for state-changing methods, reject any request whose
// Origin header is present but does not belong to an allowed origin.
// In production (same-origin), the browser never attaches Origin to a
// same-origin fetch/XHR, so legitimate requests pass through. Only
// cross-site requests (HTML form POSTs, cross-origin fetch) carry a foreign
// Origin and will be rejected — preventing login-CSRF and reset-email spam.
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!STATE_CHANGING_METHODS.has(req.method)) { next(); return; }
  const origin = req.headers.origin;
  if (origin !== undefined && !allowedOriginsSet.has(origin)) {
    res.status(403).json({ error: "Forbidden: invalid request origin" });
    return;
  }
  next();
});

// In production: serve the built React frontend as static files.
// The frontend is built to artifacts/hireboost-ai/dist/public relative to
// the repo root (where the run command is executed from).
if (isProduction) {
  const frontendDist = path.resolve(process.cwd(), "artifacts/hireboost-ai/dist/public");
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    logger.info({ frontendDist }, "Serving frontend static files");
  } else {
    logger.warn({ frontendDist }, "Frontend dist directory not found — skipping static serving");
  }
}

// Webhook routes must receive the raw request body for HMAC signature validation.
// Mount them BEFORE express.json() using express.raw() so the body is not parsed.
app.use("/api/webhooks", express.raw({ type: "application/json", limit: "256kb" }), webhookRouter);

app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// General rate limit: 100 requests per minute per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Strict rate limit for expensive AI endpoints: 10 requests per minute per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests, please slow down." },
});

// Rate limit for CPU-intensive file parsing: 20 requests per 15 minutes per IP.
// Tighter than the general limiter to limit parser-bomb throughput without
// blocking normal resume upload workflows.
const parseFileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many file parse requests, please try again later." },
});

// Auth rate limit: 10 login/register attempts per 15 minutes per IP.
// Prevents password spraying and credential-stuffing attacks on the login and
// registration endpoints without affecting other API routes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later." },
});

// Password-reset rate limit: 5 requests per hour per IP.
// Limits reset-email spam against arbitrary addresses.
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password reset requests, please try again later." },
});

app.use("/api", generalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", passwordResetLimiter);
// Dedicated limiter for CPU-intensive file parsing (applied before the route handler).
app.post("/api/resume/parse-file", parseFileLimiter);
app.use("/api/resume/analyze", aiLimiter);
app.use("/api/resume/rewrite", aiLimiter);
app.post("/api/interview/sessions", aiLimiter);
// The trailing-slash variant (/answer/) must also hit the AI limiter.
// Express default non-strict routing accepts both forms; the regex covers both.
app.post(/^\/api\/interview\/sessions\/\d+\/answer\/?$/, aiLimiter);
app.post("/api/interview/jd-prep", aiLimiter);
app.post("/api/linkedin/generate", aiLimiter);
app.post("/api/linkedin/make-viral", aiLimiter);
app.post("/api/salary/generate", aiLimiter);

// Session middleware — PostgreSQL-backed store so sessions survive restarts
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set");
}

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      conString: databaseUrl,
      tableName: "user_sessions",
      createTableIfMissing: true,
      // Prune expired sessions every hour
      pruneSessionInterval: 60 * 60,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // secure must be true in production (served over HTTPS via Replit proxy)
      // trust proxy (set above) ensures express knows the connection is HTTPS
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      // SameSite=lax: the frontend and API share the same domain (path-based
      // routing), so lax is sufficient and prevents cross-site request forgery.
      // "none" is not needed and would allow browsers to send the cookie on
      // requests originating from other sites.
      sameSite: "lax",
    },
  }),
);

// Per-user AI rate limit: 10 requests per minute per authenticated user.
// This runs AFTER session middleware so req.session.userId is available.
// Combined with the IP-based aiLimiter above, an attacker cannot bypass the
// cap simply by rotating source IPs — every session identity is tracked
// independently as well.
const userAiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user:${(req.session as { userId?: number } | undefined)?.userId ?? req.ip ?? "anon"}`,
  message: { error: "Too many AI requests, please slow down." },
});

app.use("/api/resume/analyze", userAiLimiter);
app.use("/api/resume/rewrite", userAiLimiter);
app.post("/api/interview/sessions", userAiLimiter);
app.post(/^\/api\/interview\/sessions\/\d+\/answer\/?$/, userAiLimiter);
app.post("/api/interview/jd-prep", userAiLimiter);
app.post("/api/linkedin/generate", userAiLimiter);
app.post("/api/linkedin/make-viral", userAiLimiter);
app.post("/api/salary/generate", userAiLimiter);

app.use("/api", router);

// In production: SPA fallback — serve index.html for all non-API routes so
// client-side routing (wouter) works correctly after a hard refresh.
if (isProduction) {
  const frontendDist = path.resolve(process.cwd(), "artifacts/hireboost-ai/dist/public");
  app.use((_req: Request, res: Response) => {
    const indexPath = path.join(frontendDist, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Not found");
    }
  });
}

export default app;
