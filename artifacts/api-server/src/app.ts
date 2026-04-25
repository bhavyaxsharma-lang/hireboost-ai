import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
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

// CORS — only allow requests from the known frontend origin.
// ALLOWED_ORIGIN must be set in production (e.g. "https://yourdomain.replit.app").
// In development the Replit dev-domain is derived automatically as a fallback.
if (isProduction && !process.env.ALLOWED_ORIGIN) {
  throw new Error("ALLOWED_ORIGIN must be set in production");
}

const allowedOrigin = (() => {
  if (process.env.ALLOWED_ORIGIN) {
    return process.env.ALLOWED_ORIGIN;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return "http://localhost:5173";
})();

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  }),
);

// Defense-in-depth: for state-changing methods, reject any request whose
// Origin header is present but does not match the allowed frontend origin.
// Requests with no Origin header (server-to-server, CLI, webhooks) are
// allowed through because they cannot carry a cross-site session cookie.
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    next();
    return;
  }
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== allowedOrigin) {
    res.status(403).json({ error: "Forbidden: invalid request origin" });
    return;
  }
  next();
});

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

export default app;
