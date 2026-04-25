import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import router from "./routes";
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

// In production, the frontend is served by this same Express process (same-origin),
// so no CORS headers or origin validation are needed — browsers allow same-origin
// requests unconditionally. REPLIT_DEV_DOMAIN is present in both dev and prod
// environments, so we must check NODE_ENV first before using it.
const allowedOrigin: string | null = (() => {
  // Explicit override always wins (e.g. custom domain cross-origin setups).
  if (process.env.ALLOWED_ORIGIN) return process.env.ALLOWED_ORIGIN;
  // Production: frontend and API share the same origin — skip CORS entirely.
  if (isProduction) return null;
  // Development: use the Replit dev domain so the Vite dev server can call the API.
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:5173";
})();

if (allowedOrigin) {
  app.use(cors({ origin: allowedOrigin, credentials: true }));
}

// Defense-in-depth: for state-changing methods, reject any request whose
// Origin header is present but does not match the allowed frontend origin.
// Skipped when same-origin (production without ALLOWED_ORIGIN) since the
// browser never sends a cross-origin Origin header in that case.
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
if (allowedOrigin) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!STATE_CHANGING_METHODS.has(req.method)) { next(); return; }
    const origin = req.headers.origin;
    if (origin !== undefined && origin !== allowedOrigin) {
      res.status(403).json({ error: "Forbidden: invalid request origin" });
      return;
    }
    next();
  });
}

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

app.use("/api", generalLimiter);
app.use("/api/resume/analyze", aiLimiter);
app.use("/api/resume/rewrite", aiLimiter);
app.post("/api/interview/sessions", aiLimiter);
app.post(/^\/api\/interview\/sessions\/\d+\/answer$/, aiLimiter);

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
