// Auth routes - register, login, logout, get current user
import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
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
// POST /auth/register
router.post("/register", async (req, res) => {
  const parseResult = RegisterUserBody.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { name, email, password } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  const genericMessage =
    "If this email is not already registered, your account has been created. Please log in to continue.";

  try {
    const existing = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    if (existing.length > 0) {
      res.status(200).json({ message: genericMessage });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.insert(users).values({
      name,
      email: normalizedEmail,
      passwordHash,
    });

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
  const normalizedEmail = email.toLowerCase().trim();

  try {
    

    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

   

    const valid = await bcrypt.compare(password, user.passwordHash);

    

    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    req.session.userId = user.id;

req.session.save((err) => {
  if (err) {
    req.log.error({ err }, "Session save failed");
    return res.status(500).json({
      error: "Session save failed",
    });
  }

  const token = signToken({
    userId: user.id,
    name: user.name,
    email: user.email,
    tokenVersion: user.tokenVersion,
  });

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
});
  } catch (err) {
    req.log.error({ err }, "Error logging in user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /auth/me
router.get("/me", async (req, res) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
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
router.post("/logout", async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Logout failed");
      return res.status(500).json({
        error: "Logout failed",
      });
    }

    res.clearCookie("connect.sid");

    res.json({
      message: "Logged out successfully",
    });
  });
});
export default router;
