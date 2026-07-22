import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db, pool } from "@workspace/db";
import { users, passwordResetOtps } from "@workspace/db";
import { eq, and,sql } from "drizzle-orm";
import { sendPasswordResetEmail, sendSignupVerificationEmail } from "../lib/email";
import { signToken } from "../lib/jwt";

const router = Router();

// Max failed verification attempts before an OTP record is permanently invalidated.
const MAX_FAILED_ATTEMPTS = 5;

// Returned for all invalid OTP states — prevents response-body account enumeration.
const INVALID_OTP_RESPONSE = { error: "OTP is invalid or has expired. Please request a new one." };

// Valid cost-10 bcrypt hash used for timing equalization on paths that skip real comparison.
// Ensures response time is ~100 ms whether or not an OTP record exists.
// Generated with: bcrypt.hashSync("dummy-timing-equalization", 10)
const DUMMY_HASH = "$2a$10$b/knHro6fyYe4t11OKYVaeEZLg2Xg7vx/6t54JE7tcXlqh8PHQSW2";

// In-memory per-email rate limit: max 3 OTP sends per 10 minutes per email.
// IP-level rate limiting is applied in app.ts; this adds a second layer so
// an attacker rotating IPs still can't spam a single victim's inbox.
const otpEmailRequests = new Map<string, { count: number; windowStart: number }>();

function checkEmailRateLimit(email: string): boolean {
  const now = Date.now();
  const WINDOW_MS = 10 * 60 * 1000;
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
router.post("/send-otp", async (req: Request, res: Response): Promise<Response | void> => {
  const { email, purpose } = req.body as { email?: string; purpose?: "password-reset" | "signup" };

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
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(sql`LOWER(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    if (purpose === "signup") {
      if (user) {
        res.status(409).json({ error: "An account with this email already exists." });
        return;
      }

      const otpNumber = crypto.randomInt(100000, 1000000);
      const otp = String(otpNumber);
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await db.transaction(async (tx: any) => {
        await tx
          .delete(passwordResetOtps)
          .where(and(eq(passwordResetOtps.email, normalizedEmail), eq(passwordResetOtps.used, false)));

        await tx.insert(passwordResetOtps).values({
          email: normalizedEmail,
          otpHash,
          expiresAt,
          used: false,
          failedAttempts: 0,
        });
      });

      try {
        await sendSignupVerificationEmail({
          to: normalizedEmail,
          otp,
        });

        return res.json({
          message: "A verification code has been sent to your email.",
        });
      } catch (err: any) {
        req.log.error({ err }, "Error sending signup verification email");

        return res.status(500).json({
          error: "Email failed",
        });
      }
    }

    if (!user) {
      // Dummy hash keeps response time comparable to the registered-email path,
      // preventing timing-based account enumeration on this public endpoint.
      await bcrypt.hash("dummy-equalize-timing", 10);
      res.json({ message: "If that email is registered, an OTP has been sent." });
      return;
    }

    const otpNumber = crypto.randomInt(100000, 1000000);
    const otp = String(otpNumber);
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Invalidate previous unused OTPs and insert the new one atomically
    await db.transaction(async (tx: any) => {
      await tx
        .delete(passwordResetOtps)
        .where(and(eq(passwordResetOtps.email, normalizedEmail), eq(passwordResetOtps.used, false)));

      await tx.insert(passwordResetOtps).values({
        email: normalizedEmail,
        otpHash,
        expiresAt,
        used: false,
        failedAttempts: 0,
      });
    });

    // Respond before sending email so SMTP latency cannot reveal account existence.
try {
  await sendPasswordResetEmail({
    to: normalizedEmail,
    otp,
  });

  return res.json({
    message: "If that email is registered, an OTP has been sent.",
  });
} catch (err: any) {
  req.log.error({ err }, "Error sending password reset email");

  return res.status(500).json({
    error: "Email failed",
  });
}
  } catch (err) {
    req.log.error({ err }, "Error sending OTP");
    res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
});

// POST /auth/verify-otp-reset
// Accepts { email, otp, newPassword } — validates OTP, updates password, revokes sessions.
router.post("/verify-otp-reset", async (req: Request, res: Response): Promise<Response | void> => {
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

    // Row-locked transaction serializes concurrent verification attempts so that
    // multiple requests cannot race past the failed-attempt ceiling.
    // Password update is also performed inside the same transaction so OTP
    // consumption and the new password are committed atomically.
    const outcome = await db.transaction(async (tx: any) => {
      const result = await tx.execute(sql`
        SELECT id,
               otp_hash        AS "otpHash",
               failed_attempts AS "failedAttempts",
               used,
               expires_at      AS "expiresAt"
        FROM   password_reset_otps
        WHERE  email      = ${normalizedEmail}
          AND  used       = false
          AND  expires_at > ${now}
        ORDER BY created_at ASC
        LIMIT  1
        FOR UPDATE
      `);

      const otpRecord = result.rows[0] as {
        id: number;
        otpHash: string;
        failedAttempts: number;
        used: boolean;
        expiresAt: Date;
      } | undefined;

      if (!otpRecord) {
        // Dummy compare equalizes timing for the no-record path
        await bcrypt.compare(otp, DUMMY_HASH);
        return { status: "no_record" } as const;
      }

      if (otpRecord.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        await tx.execute(sql`UPDATE password_reset_otps SET used = true WHERE id = ${otpRecord.id}`);
        await bcrypt.compare(otp, DUMMY_HASH);
        return { status: "locked" } as const;
      }

      const isValid = await bcrypt.compare(otp, otpRecord.otpHash);

      if (!isValid) {
        const newFailedAttempts = otpRecord.failedAttempts + 1;
        const shouldInvalidate = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
        await tx.execute(sql`
          UPDATE password_reset_otps
          SET    failed_attempts = ${newFailedAttempts}
                 ${shouldInvalidate ? sql`, used = true` : sql``}
          WHERE  id = ${otpRecord.id}
        `);
        return { status: "wrong_otp" } as const;
      }

      // OTP verified — look up user and update password atomically with OTP consumption
      const userResult = await tx.execute(sql`
  SELECT id
  FROM users
  WHERE LOWER(email) = ${normalizedEmail}
  LIMIT 1
`);
      const userId = (userResult.rows[0] as { id: number } | undefined)?.id;

      if (!userId) {
        return { status: "no_user" } as const;
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      

      await tx.execute(sql`UPDATE users SET password_hash = ${passwordHash}, token_version = token_version + 1 WHERE id = ${userId}`);
      await tx.execute(sql`UPDATE password_reset_otps SET used = true WHERE id = ${otpRecord.id}`);

      return { status: "valid", userId } as const;
    });

    if (outcome.status !== "valid") {
      res.status(400).json(INVALID_OTP_RESPONSE);
      return;
    }

    // Revoke all active sessions so stolen cookies can't be reused
    if (!pool) {
      res.status(500).json({ error: "Session store is unavailable" });
      return;
    }

    await pool.query(
      `DELETE FROM user_sessions WHERE sess->>'userId' = $1`,
      [String(outcome.userId)]
    );

    res.json({ message: "Password updated successfully. You can now log in." });
  } catch (err) {
    req.log.error({ err }, "Error verifying OTP reset");
    res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

router.post("/verify-signup-otp", async (req: Request, res: Response): Promise<Response | void> => {
  const { email, otp, name, password } = req.body as {
    email?: string;
    otp?: string;
    name?: string;
    password?: string;
  };

  if (!email || !otp || !name || !password || typeof email !== "string" || typeof otp !== "string" || typeof name !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Email, OTP, name, and password are all required." });
    return;
  }

  if (name.trim().length < 2) {
    res.status(400).json({ error: "Please enter your full name." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const now = new Date();

    const outcome = await db.transaction(async (tx: any) => {
      const result = await tx.execute(sql`
        SELECT id,
               otp_hash        AS "otpHash",
               failed_attempts AS "failedAttempts",
               used,
               expires_at      AS "expiresAt"
        FROM   password_reset_otps
        WHERE  email      = ${normalizedEmail}
          AND  used       = false
          AND  expires_at > ${now}
        ORDER BY created_at ASC
        LIMIT  1
        FOR UPDATE
      `);

      const otpRecord = result.rows[0] as {
        id: number;
        otpHash: string;
        failedAttempts: number;
        used: boolean;
        expiresAt: Date;
      } | undefined;

      if (!otpRecord) {
        await bcrypt.compare(otp, DUMMY_HASH);
        return { status: "no_record" } as const;
      }

      if (otpRecord.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        await tx.execute(sql`UPDATE password_reset_otps SET used = true WHERE id = ${otpRecord.id}`);
        await bcrypt.compare(otp, DUMMY_HASH);
        return { status: "locked" } as const;
      }

      const isValid = await bcrypt.compare(otp, otpRecord.otpHash);

      if (!isValid) {
        const newFailedAttempts = otpRecord.failedAttempts + 1;
        const shouldInvalidate = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
        await tx.execute(sql`
          UPDATE password_reset_otps
          SET    failed_attempts = ${newFailedAttempts}
                 ${shouldInvalidate ? sql`, used = true` : sql``}
          WHERE  id = ${otpRecord.id}
        `);
        return { status: "wrong_otp" } as const;
      }

      const existingUserResult = await tx.execute(sql`
        SELECT id
        FROM users
        WHERE LOWER(email) = ${normalizedEmail}
        LIMIT 1
      `);
      const existingUserId = (existingUserResult.rows[0] as { id: number } | undefined)?.id;

      if (existingUserId) {
        return { status: "email_exists" } as const;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await tx.execute(sql`
        INSERT INTO users (name, email, password_hash, token_version)
        VALUES (${name.trim()}, ${normalizedEmail}, ${passwordHash}, 0)
      `);
      await tx.execute(sql`UPDATE password_reset_otps SET used = true WHERE id = ${otpRecord.id}`);

      const userResult = await tx.execute(sql`
        SELECT id
        FROM users
        WHERE LOWER(email) = ${normalizedEmail}
        LIMIT 1
      `);
      const userId = (userResult.rows[0] as { id: number } | undefined)?.id;

      return { status: "valid", userId } as const;
    });

    if (outcome.status !== "valid") {
      if (outcome.status === "email_exists") {
        res.status(409).json({ error: "An account with this email already exists." });
        return;
      }
      res.status(400).json(INVALID_OTP_RESPONSE);
      return;
    }

    const userId = outcome.userId;
    if (!userId) {
      res.status(500).json({ error: "Failed to create account." });
      return;
    }

    req.session.userId = userId;
    await new Promise<void>((resolve) => {
      req.session.save((err) => {
        if (err) {
          req.log.error({ err }, "Session save failed");
          res.status(500).json({ error: "Session save failed" });
          resolve();
          return;
        }

        const token = signToken({
          userId,
          name: name.trim(),
          email: normalizedEmail,
          tokenVersion: 0,
        });

        res.json({
          user: {
            id: userId,
            name: name.trim(),
            email: normalizedEmail,
          },
          token,
          message: "Account created successfully.",
        });
        resolve();
      });
    });
  } catch (err) {
    req.log.error({ err }, "Error verifying signup OTP");
    res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

export default router;
