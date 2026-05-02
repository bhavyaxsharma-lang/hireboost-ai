import { logger } from "./logger";

const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? "HireBoost AI <onboarding@resend.dev>";

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  logContext?: Record<string, unknown>;
}): Promise<void> {
  const { to, subject, html, logContext } = opts;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.warn(
      { to, subject, ...logContext },
      "RESEND_API_KEY not set — email logged to server only (dev mode)"
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }

  logger.info({ to, subject }, "Email sent");
}

/**
 * Sends a 6-digit OTP for password reset.
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
        Use the OTP below to reset your password. It is valid for
        <strong>5 minutes</strong> and can only be used once.
      </p>
      <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#2563eb;font-family:monospace">
          ${otp}
        </span>
      </div>
      <p style="color:#888;font-size:13px">
        If you didn't request a password reset, you can safely ignore this email.
        Your password will not change.
      </p>
    </div>
  `;

  await sendEmail({
    to,
    subject: "Reset your HireBoost AI password",
    html,
    logContext: { type: "otp" },
  });
}

/**
 * @deprecated Use sendOtpEmail instead.
 * Kept for any remaining references during transition.
 */
export async function sendPasswordResetEmail(opts: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  const { to, resetUrl } = opts;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1a1a1a">Reset your HireBoost AI password</h2>
      <p style="color:#444">
        We received a request to reset the password for your account. Click the
        button below to choose a new password. This link expires in <strong>1 hour</strong>.
      </p>
      <a href="${resetUrl}"
         style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Reset password
      </a>
      <p style="color:#888;font-size:13px">
        If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
  `;

  await sendEmail({ to, subject: "Reset your HireBoost AI password", html });
}
