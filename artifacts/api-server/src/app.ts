import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import path from "path";
import fs from "fs";
import http from "http";
import router from "./routes";
import webhookRouter from "./routes/webhook";
import { logger } from "./lib/logger";
import { verifyToken } from "./lib/jwt";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";

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
  process.env.ALLOWED_ORIGIN
    .split(",")
    .map(origin => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
    .forEach(origin => allowedOriginsSet.add(origin));
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
  // Development: allow the main Replit dev domain (web app) and the Expo dev
  // domain (mobile canvas). Both need to reach the API from different origins.
  if (process.env.REPLIT_DEV_DOMAIN) {
    allowedOriginsSet.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }

  allowedOriginsSet.add("http://localhost:5173");
  allowedOriginsSet.add("http://127.0.0.1:5173");
  allowedOriginsSet.add("http://192.168.1.15:5173");
  if (process.env.REPLIT_EXPO_DEV_DOMAIN) {
    allowedOriginsSet.add(`https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`);
  }
}

// CORS: reflect the requesting origin back when it is in the allowlist so that
// both the web app (main dev domain) and the mobile canvas (Expo dev domain)
// can make credentialed requests in development. A function origin is required
// for multiple allowed origins — a static string only matches one.
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin (same-origin, curl, server-to-server).
      if (!origin) { callback(null, true); return; }
      if (allowedOriginsSet.has(origin)) {
        callback(null, origin);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);

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
    logger.warn({ origin, allowlist: [...allowedOriginsSet] }, "Rejected request from disallowed origin");

    res.status(403).json({
      error: "Forbidden: invalid request origin",
      origin,
      allowlist: [...allowedOriginsSet]
    });

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

// Expo Go manifest proxy — runs before body-parsing middleware so the raw
// request can be piped. When Replit's URL bar QR code sends Expo Go to
// exps://EXPO_DEV_DOMAIN (root /), we detect Expo-specific Accept headers and
// forward the request to the mobile proxy (port 25516 at /mobile/), which
// strips the prefix, talks to Metro, and rewrites manifest URLs to include /mobile/.
// This makes both the Replit QR code AND a manual exps://EXPO_DEV_DOMAIN/mobile work.
const MOBILE_PROXY_PORT = 25516;
app.use((req: Request, res: Response, next: NextFunction) => {
  const accept = req.headers["accept"] || "";
  const expoPlatform = req.headers["expo-platform"];
  const isExpoGoRequest = accept.includes("application/expo") || !!expoPlatform;
  if (!isExpoGoRequest) { next(); return; }

  const targetPath = `/mobile${req.url === "/" ? "/" : req.url}`;
  const options: http.RequestOptions = {
    hostname: "localhost",
    port: MOBILE_PROXY_PORT,
    path: targetPath,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${MOBILE_PROXY_PORT}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });
  proxyReq.on("error", (err) => {
    logger.error({ err }, "Expo manifest proxy error");
    if (!res.headersSent) res.status(502).send("Bad Gateway");
  });
  req.pipe(proxyReq, { end: true });
});

// Development-only: proxy non-API, non-Expo requests to the Vite dev server.
// The API server's artifact.toml must claim "/" for production (to serve the
// React SPA). In development the shared proxy may route "/" here instead of
// to Vite (port 22412), leaving the frontend unreachable. This middleware
// transparently forwards those requests so the preview pane always works.
if (!isProduction) {
  const VITE_PORT = parseInt(process.env.VITE_PORT || "22412", 10);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) { next(); return; }
    const proxyReq = http.request(
      {
        hostname: "localhost",
        port: VITE_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `localhost:${VITE_PORT}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }
    );
    proxyReq.on("error", () => next());
    req.pipe(proxyReq, { end: true });
  });
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

// OTP send rate limit: 5 requests per 10 minutes per IP.
// A second per-email layer is enforced in the route handler itself.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many OTP requests, please try again later." },
});

// Password-reset rate limit: 5 requests per hour per IP (legacy — kept for safety).
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
app.use("/api/auth/send-otp", otpLimiter);
app.use("/api/auth/verify-otp-reset", passwordResetLimiter);
app.use("/api/auth/verify-signup-otp", passwordResetLimiter);
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

// Fail-closed webhook guard: if either Razorpay key is present, all three must be
// configured together. Partial configuration is rejected at startup because:
//   - RAZORPAY_KEY_ID without RAZORPAY_KEY_SECRET: payment API calls will fail at
//     runtime, potentially after credits have already been promised.
//   - Either key without RAZORPAY_WEBHOOK_SECRET: post-settlement reversals (refunds,
//     disputes) cannot be reconciled — users could spend paid credits after charge
//     reversal.
// Refusing to start is safer than silently selling credits with broken reconciliation.
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
const razorpayEnabled = razorpayKeyId || razorpayKeySecret;
if (razorpayEnabled) {
  const missing: string[] = [];
  if (!razorpayKeyId) missing.push("RAZORPAY_KEY_ID");
  if (!razorpayKeySecret) missing.push("RAZORPAY_KEY_SECRET");
  if (!razorpayWebhookSecret) missing.push("RAZORPAY_WEBHOOK_SECRET");
  if (missing.length > 0) {
    throw new Error(
      `Incomplete Razorpay configuration: ${missing.join(", ")} must be set. ` +
      "All three Razorpay variables must be configured together. " +
      "RAZORPAY_WEBHOOK_SECRET is required to reconcile refunds and disputes — " +
      "without it paid credits remain valid after charge reversal."
    );
  }
}

// Session middleware — PostgreSQL-backed store so sessions survive restarts

const isMockMode = process.env.MOCK_RESPONSES === "true";
const sessionSecret =
  process.env.SESSION_SECRET ||
  (isMockMode ? "mock-session-secret" : undefined);

if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

const databaseUrl = process.env.DATABASE_URL;
if (!isMockMode && !databaseUrl) {
  throw new Error("DATABASE_URL must be set");
}

const sessionOptions: session.SessionOptions = {
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
cookie: {
  httpOnly: true,
  sameSite: "none",
  secure: true,
  maxAge: 1000 * 60 * 60 * 24 * 7,
},
};

if (!isMockMode) {
  const PgSession = connectPgSimple(session);
  sessionOptions.store = new PgSession({
    conString: databaseUrl,
    tableName: "user_sessions",
    createTableIfMissing: true,
    // Prune expired sessions every hour
    pruneSessionInterval: 60 * 60,
  });
}

app.use(session(sessionOptions));

// Populate req.userId from the active server session. This runs before the
// bearer middleware so cookie-authenticated requests are resolved first.
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.session?.userId) {
    req.userId = req.session.userId;
  }
  next();
});

// Bearer token middleware — runs AFTER the session middleware and the session
// userId sync above. Mobile clients send a JWT in the Authorization: Bearer
// header. When no session user is already set, we verify the JWT signature and
// then check the token version stored in the database so that logout and
// password-reset can immediately invalidate all outstanding tokens.
//
// IMPORTANT: We deliberately do NOT write to req.session here. Writing
// req.session.userId would mark the session as modified and cause
// express-session to persist a new row in user_sessions for every
// bearer-only request, enabling storage-amplification denial of service.
app.use(async (req: Request, _res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ") && !req.userId) {
    const token = auth.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      try {
        const [user] = await db
          .select({ tokenVersion: users.tokenVersion })
          .from(users)
          .where(eq(users.id, payload.userId))
          .limit(1);
        // Only authenticate if the token version matches the current DB value.
        // A mismatch means the token was invalidated by a logout or password reset.
        if (user && user.tokenVersion === payload.tokenVersion) {
          req.userId = payload.userId;
        }
      } catch (err) {
        // DB error — deny bearer auth on this request rather than crashing.
        logger.warn({ err }, "Bearer middleware: DB lookup failed, denying bearer auth");
      }
    }
  }
  next();
});

// Per-user AI rate limit: 10 requests per minute per authenticated user.
// This runs AFTER the auth middleware chain so req.userId is available.
// Combined with the IP-based aiLimiter above, an attacker cannot bypass the
// cap simply by rotating source IPs — every user identity is tracked
// independently as well.
const userAiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.userId ? `user:${req.userId}` : `ip:${ipKeyGenerator(req as any)}`;
  },
  message: { error: "Too many AI requests, please slow down." },
});

app.use("/api/resume/analyze", userAiLimiter);
app.use("/api/resume/rewrite", userAiLimiter);
app.post("/api/resume/parse-file", userAiLimiter);
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
