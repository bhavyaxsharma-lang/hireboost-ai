import { logger } from "./logger";

/**
 * Sends a password reset email via Resend.
 *
 * Requires the RESEND_API_KEY environment variable and a verified sender domain
 * configured in your Resend dashboard. In development, when RESEND_API_KEY is
 * absent, the link is written to server logs only — it is never returned to the
 * caller so the production security invariant is preserved.
 */
export async function sendPasswordResetEmail(opts: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  const { to, resetUrl } = opts;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.warn(
      { resetUrl, to },
      "RESEND_API_KEY not set — password reset link logged to server only (dev mode)"
    );
    return;
  }

  const fromAddress =
    process.env.EMAIL_FROM ?? "HireBoost AI <onboarding@resend.dev>";

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
        Your password won't change until you click the link above.
      </p>
      <p style="color:#bbb;font-size:12px">
        Can't click the button? Copy and paste this URL into your browser:<br>
        <span style="word-break:break-all">${resetUrl}</span>
      </p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [to],
      subject: "Reset your HireBoost AI password",
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }

  logger.info({ to }, "Password reset email sent");
}
