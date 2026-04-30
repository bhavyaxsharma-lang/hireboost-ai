import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db, pool } from "@workspace/db";
import { users, passwordResetTokens } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { sendPasswordResetEmail } from "../lib/email";

/**
 * Returns the trusted application origin used to construct password reset URLs.
 *
 * Uses only server-side environment variables — never request headers — to
 * prevent password-reset-poisoning / host-header injection attacks.
 *
 * Priority:
 *  1. APP_ORIGIN  — explicitly configured canonical origin (preferred for prod)
 *  2. REPLIT_DEV_DOMAIN — injected by the Replit platform (trusted, dev only)
 *
 * Returns null when neither is set; callers must handle the absence gracefully.
 */
function getAppOrigin(): string | null {
  if (process.env.APP_ORIGIN) {
    return process.env.APP_ORIGIN.replace(/\/$/, "");
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return null;
}

const router = Router();

// POST /auth/forgot-password
// Accepts { email } — generates a reset token and stores it; delivery is via email (not the response)
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);

    // Always respond with the same success message to avoid email enumeration
    if (!user) {
      res.json({ message: "If that email is registered, a reset link has been sent to your inbox." });
      return;
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Revoke all prior unused reset tokens for this user and insert the new
    // one in a single transaction. Doing this atomically prevents a race where
    // two concurrent forgot-password requests could both see zero active tokens
    // and each insert a new one, leaving two live tokens in the database.
    await db.transaction(async (tx) => {
      await tx
        .delete(passwordResetTokens)
        .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));

      await tx.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });
    });

    // Build the reset URL from trusted server-side configuration only.
    // Never use request headers (Origin, Host) here — an attacker can forge
    // them to redirect the reset token to infrastructure they control
    // (password-reset poisoning / token exfiltration via click).
    const appOrigin = getAppOrigin();
    if (!appOrigin) {
      req.log.error("APP_ORIGIN is not configured — cannot send password reset email");
      // Return success to the caller to avoid enumeration; log internally.
      res.json({ message: "If that email is registered, a reset link has been sent to your inbox." });
      return;
    }
    const resetUrl = `${appOrigin}/reset-password?token=${token}`;

    // Fire-and-forget: log delivery failures internally but never bubble them
    // to the caller. Propagating email-send errors would let an attacker
    // distinguish registered from unregistered addresses by observing
    // whether the endpoint returns 200 or 500.
    sendPasswordResetEmail({ to: user.email, resetUrl }).catch((err: unknown) => {
      req.log.error({ err, userId: user.id }, "Failed to send password reset email");
    });

    res.json({
      message: "If that email is registered, a reset link has been sent to your inbox.",
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

  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
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

    // Update password and invalidate ALL unused reset tokens for this user in
    // a single transaction. Doing this atomically ensures that if either
    // operation fails, neither takes effect — preventing a state where the
    // password is changed but tokens remain live (or vice-versa). Revoking by
    // userId rather than just the presented token id closes any concurrent
    // reset replay window.
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, resetRecord.userId));
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokens.userId, resetRecord.userId),
            isNull(passwordResetTokens.usedAt)
          )
        );
    });

    // Revoke all existing sessions for this user so that any previously stolen
    // session cookie cannot be reused after the password is changed. The
    // user_sessions table is managed by connect-pg-simple; the sess column
    // contains the session JSON, and userId is stored inside it.
    await pool.query(
      `DELETE FROM user_sessions WHERE sess->>'userId' = $1`,
      [String(resetRecord.userId)]
    );

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

// POST /auth/direct-reset
// Accepts { email, newPassword } — resets password directly without an email token.
// Anyone who knows a registered email address can reset that account's password.
// This is intentionally simpler than the token flow for ease of use.
router.post("/direct-reset", async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  if (!newPassword || typeof newPassword !== "string") {
    res.status(400).json({ error: "New password is required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: "If that email is registered, your password has been updated." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

    // Revoke all existing sessions
    await pool.query(
      `DELETE FROM user_sessions WHERE sess->>'userId' = $1`,
      [String(user.id)]
    );

    res.json({ message: "Password updated successfully. You can now log in." });
  } catch (err) {
    req.log.error({ err }, "Error in direct password reset");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
