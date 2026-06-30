import nodemailer from "nodemailer";
import { logger } from "./logger";

/**
 * Creates a nodemailer transporter.
 * Supports two modes:
 *   1. Gmail SMTP  — GMAIL_USER + GMAIL_APP_PASSWORD are set (recommended)
 *   2. Resend SMTP — RESEND_API_KEY is set (legacy fallback)
 *
 * In development with neither key set, emails are only logged to the console.
 */
function createTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (gmailUser && gmailPass) {
return nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // SSL
  auth: {
    user: gmailUser,
    pass: gmailPass,
  },
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 10000,
  tls: {
    rejectUnauthorized: true,
  },
});
  }

  // Resend SMTP fallback (requires verified domain for non-owner emails)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    return nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 587,
      secure: false,
      auth: { user: "resend", pass: resendKey },
    });
  }

  return null;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const { to, subject, html, text } = opts;

const transporter = createTransporter();

if (!transporter) {
  logger.warn(
    { to, subject },
    "No email credentials configured"
  );
  return;
}

console.log("=== EMAIL DEBUG ===");
console.log("GMAIL_USER:", process.env.GMAIL_USER);
console.log("GMAIL_APP_PASSWORD exists:", !!process.env.GMAIL_APP_PASSWORD);
console.log("TO:", to);

// Verify SMTP connection first
try {
  await transporter.verify();
  console.log("✅ SMTP connection successful");

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });

  console.log("EMAIL SENT:", info.messageId);
  console.log(info);

  logger.info({ to, subject }, "Email sent");
} catch (err: any) {
  console.error("========== SMTP ERROR ==========");
  console.error("Message:", err?.message);
  console.error("Code:", err?.code);
  console.error("Response:", err?.response);
  console.error("Response Code:", err?.responseCode);
  console.error(err);
  console.error("================================");
  throw err;
}
}

/**
 * Sends a 6-digit OTP for password reset.
 * Works with any email address when using Gmail SMTP.
 */
export async function sendOtpEmail(opts: {
  to: string;
  otp: string;
}): Promise<void> {
  const { to, otp } = opts;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#1a1a1a;margin-bottom:8px">Reset your HireBoost AI password</h2>
      <p style="color:#444;margin-bottom:24px">
        Use the one-time code below to reset your password.
        It is valid for <strong>5 minutes</strong> and can only be used once.
      </p>
      <div style="background:#f4f4f5;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
        <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#2563eb;font-family:monospace">
          ${otp}
        </span>
      </div>
      <p style="color:#888;font-size:13px">
        If you didn't request a password reset, you can safely ignore this email.
        Your password will not change.
      </p>
      <p style="color:#bbb;font-size:12px;margin-top:16px">
        — The HireBoost AI team
      </p>
    </div>
  `;

  const text = `Your HireBoost AI password reset OTP is: ${otp}\n\nIt is valid for 5 minutes and can only be used once.\n\nIf you didn't request this, please ignore this email.`;

  await sendEmail({
    to,
    subject: "Reset Your HireBoost AI Password",
    html,
    text,
  });
}

/**
 * @deprecated Use sendOtpEmail instead.
 */
export async function sendPasswordResetEmail(opts: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  const { to, resetUrl } = opts;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1a1a1a">Reset your HireBoost AI password</h2>
      <p style="color:#444">Click the button below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetUrl}"
         style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Reset password
      </a>
      <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  await sendEmail({ to, subject: "Reset your HireBoost AI password", html });
}
