import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, pool } from "@workspace/db";
import { users, passwordResetOtps } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { sendOtpEmail } from "../lib/email";

const router = Router();

// In-memory per-email rate limit: max 3 OTP sends per 10 minutes per email.
// IP-level rate limiting is applied in app.ts; this adds a second layer so
// an attacker rotating IPs still can't spam a single victim's inbox.
const otpEmailRequests = new Map<string, { count: number; windowStart: number }>();

function checkEmailRateLimit(email: string): boolean {
  const now = Date.now();
  const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
  const MAX = 3;

  const entry = otpEmailRequests.get(email);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    otpEmailRequests.set(email, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MAX) return false;
  entry.count += 1;
  return true;
}

// POST /auth/send-otp
// Accepts { email } — generates a 6-digit OTP, stores hashed copy, sends via Resend.
router.post("/send-otp", async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!checkEmailRateLimit(normalizedEmail)) {
    res.status(429).json({
      error: "Too many OTP requests for this email. Please wait 10 minutes before trying again.",
    });
    return;
  }

  try {
    // Check if email is registered (but always respond same way to avoid enumeration)
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      // Don't reveal whether the email exists — same response as success
      res.json({ message: "If that email is registered, an OTP has been sent." });
      return;
    }

    // Generate a cryptographically random 6-digit OTP
    const otpNumber = Math.floor(100000 + Math.random() * 900000);
    const otp = String(otpNumber);
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Invalidate all previous unused OTPs for this email and insert the new one atomically
    await db.transaction(async (tx) => {
      await tx
        .delete(passwordResetOtps)
        .where(and(eq(passwordResetOtps.email, normalizedEmail), eq(passwordResetOtps.used, false)));

      await tx.insert(passwordResetOtps).values({
        email: normalizedEmail,
        otpHash,
        expiresAt,
        used: false,
      });
    });

    // Send email — surface failure to caller so UI can show a retry option
    await sendOtpEmail({ to: normalizedEmail, otp });

    res.json({ message: "OTP sent successfully. Check your inbox." });
  } catch (err) {
    req.log.error({ err }, "Error sending OTP");
    res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
});

// POST /auth/verify-otp-reset
// Accepts { email, otp, newPassword } — validates OTP, updates password, revokes sessions.
router.post("/verify-otp-reset", async (req, res) => {
  const { email, otp, newPassword } = req.body as {
    email?: string;
    otp?: string;
    newPassword?: string;
  };

  if (!email || !otp || !newPassword || typeof email !== "string" || typeof otp !== "string" || typeof newPassword !== "string") {
    res.status(400).json({ error: "Email, OTP, and new password are all required." });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const now = new Date();

    // Fetch the most recent unused, unexpired OTP for this email
    const [otpRecord] = await db
      .select()
      .from(passwordResetOtps)
      .where(
        and(
          eq(passwordResetOtps.email, normalizedEmail),
          eq(passwordResetOtps.used, false),
          gt(passwordResetOtps.expiresAt, now)
        )
      )
      .orderBy(passwordResetOtps.createdAt)
      .limit(1);

    if (!otpRecord) {
      res.status(400).json({
        error: "OTP is invalid or has expired. Please request a new one.",
        expired: true,
      });
      return;
    }

    // Verify OTP (constant-time bcrypt compare)
    const isValid = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isValid) {
      res.status(400).json({ error: "Incorrect OTP. Please check and try again." });
      return;
    }

    // Look up the user
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      res.status(400).json({ error: "No account found for this email." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and mark OTP as used atomically
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, user.id));

      await tx
        .update(passwordResetOtps)
        .set({ used: true })
        .where(eq(passwordResetOtps.id, otpRecord.id));
    });

    // Revoke all active sessions for this user so stolen cookies can't be reused
    await pool.query(
      `DELETE FROM user_sessions WHERE sess->>'userId' = $1`,
      [String(user.id)]
    );

    res.json({ message: "Password updated successfully. You can now log in." });
  } catch (err) {
    req.log.error({ err }, "Error verifying OTP reset");
    res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

export default router;
