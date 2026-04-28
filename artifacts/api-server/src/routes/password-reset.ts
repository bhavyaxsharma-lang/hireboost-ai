import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { users, passwordResetTokens } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";

const router = Router();

// POST /auth/forgot-password
// Accepts { email } — creates a token and returns the reset link (shown on-screen for now)
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);

    // Always respond with success to avoid email enumeration
    if (!user) {
      res.json({ message: "If that email is registered, a reset link has been generated." });
      return;
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    // Build the reset URL (works for both dev and production)
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const resetUrl = `${origin}/reset-password?token=${token}`;

    res.json({
      message: "Reset link generated successfully.",
      resetUrl,
      expiresIn: "1 hour",
    });
  } catch (err) {
    req.log.error({ err }, "Error generating password reset token");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/reset-password
// Accepts { token, newPassword }
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || typeof token !== "string" || typeof newPassword !== "string") {
    res.status(400).json({ error: "Token and new password are required" });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  try {
    const now = new Date();

    // Find a valid, unused, non-expired token
    const [resetRecord] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now)
        )
      )
      .limit(1);

    if (!resetRecord) {
      res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and mark token as used in parallel
    await Promise.all([
      db.update(users).set({ passwordHash }).where(eq(users.id, resetRecord.userId)),
      db.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.id, resetRecord.id)),
    ]);

    res.json({ message: "Password updated successfully. You can now log in." });
  } catch (err) {
    req.log.error({ err }, "Error resetting password");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /auth/verify-reset-token?token=xxx
// Used by the frontend to check if a token is still valid before showing the form
router.get("/verify-reset-token", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  try {
    const now = new Date();
    const [resetRecord] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now)
        )
      )
      .limit(1);

    if (!resetRecord) {
      res.status(400).json({ valid: false, error: "This reset link is invalid or has expired." });
      return;
    }

    res.json({ valid: true });
  } catch (err) {
    req.log.error({ err }, "Error verifying reset token");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
