import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
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

// Allow requests from any origin (Replit proxy)
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

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

const isProduction = process.env.NODE_ENV === "production";

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
      // SameSite=none required for cross-origin cookie in production
      sameSite: isProduction ? "none" : "lax",
    },
  }),
);

app.use("/api", router);

export default app;
