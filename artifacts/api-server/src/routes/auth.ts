// Auth routes - register, login, logout, get current user
import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  RegisterUserBody,
  LoginUserBody,
} from "@workspace/api-zod";
import { signToken } from "../lib/jwt";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const router = Router();

// POST /auth/register
router.post("/register", async (req, res) => {
  const parseResult = RegisterUserBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { name, email, password } = parseResult.data;

  // Use a constant-time generic message for both existing and new accounts to
  // prevent email enumeration: callers cannot distinguish the two cases.
  const genericMessage = "If this email is not already registered, your account has been created. Please log in to continue.";

  try {
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      // Silently discard — same response as success to prevent enumeration
      res.status(200).json({ message: genericMessage });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.insert(users).values({ name, email, passwordHash });

    // Do not auto-login: returning a uniform message prevents callers from
    // distinguishing a new registration from a duplicate-email attempt.
    res.status(200).json({ message: genericMessage });
  } catch (err) {
    req.log.error({ err }, "Error registering user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const parseResult = LoginUserBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { email, password } = parseResult.data;

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Set session (for web clients)
    req.session.userId = user.id;

    // Sign a JWT token for mobile clients
    const token = signToken({ userId: user.id, name: user.name, email: user.email });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      token,
      message: "Logged in successfully",
    });
  } catch (err) {
    req.log.error({ err }, "Error logging in user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

// GET /auth/me
router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting current user");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
