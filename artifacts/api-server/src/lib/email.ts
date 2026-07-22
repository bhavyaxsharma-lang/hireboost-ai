import { Resend } from "resend";

const isMockMode = process.env.MOCK_RESPONSES === "true";
let resend: any;

if (!isMockMode) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  // In mock mode, provide a noop client for local testing without leaking OTP codes.
  resend = {
    emails: {
      send: async () => ({ error: undefined }),
    },
  };
}

function buildSignupVerificationEmailHtml(opts: { name?: string; otp: string }) {
  const name = opts.name?.trim() || "there";

  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin-bottom:16px;color:#111827;font-size:24px">Welcome to HireBoost AI!</h2>
      <p style="margin-bottom:24px;color:#4b5563;font-size:16px;line-height:1.6">
        Hi ${name},
      </p>
      <p style="margin-bottom:24px;color:#4b5563;font-size:16px;line-height:1.6">
        Thank you for creating your HireBoost AI account.
      </p>
      <p style="margin-bottom:24px;color:#4b5563;font-size:16px;line-height:1.6">
        To activate your account, please verify your email address using the verification code below.
      </p>
      <div style="background:#f3f4f6;padding:24px;text-align:center;border-radius:12px;margin:0 auto 24px;max-width:320px">
        <span style="font-size:42px;font-weight:700;letter-spacing:0.2em;color:#2563eb;line-height:1">${opts.otp}</span>
      </div>
      <p style="margin-bottom:16px;color:#4b5563;font-size:15px;line-height:1.6">
        This verification code is valid for 5 minutes.
      </p>
      <p style="margin-bottom:16px;color:#4b5563;font-size:15px;line-height:1.6">
        If you did not create a HireBoost AI account, you can safely ignore this email.
      </p>
      <p style="margin-bottom:0;color:#6b7280;font-size:13px;line-height:1.6">
        Thank you,
        <br />
        The HireBoost AI Team
      </p>
      <p style="margin-top:28px;color:#9ca3af;font-size:12px;line-height:1.5">— HireBoost AI</p>
    </div>
  `;
}

function buildPasswordResetEmailHtml(opts: { name?: string; otp: string }) {
  const name = opts.name?.trim() || "there";

  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin-bottom:16px;color:#111827;font-size:24px">Reset your HireBoost AI password</h2>
      <p style="margin-bottom:24px;color:#4b5563;font-size:16px;line-height:1.6">
        Hi ${name},
      </p>
      <p style="margin-bottom:24px;color:#4b5563;font-size:16px;line-height:1.6">
        We received a request to reset your HireBoost AI password.
      </p>
      <p style="margin-bottom:24px;color:#4b5563;font-size:16px;line-height:1.6">
        Use the verification code below to continue.
      </p>
      <div style="background:#f3f4f6;padding:24px;text-align:center;border-radius:12px;margin:0 auto 24px;max-width:320px">
        <span style="font-size:42px;font-weight:700;letter-spacing:0.2em;color:#2563eb;line-height:1">${opts.otp}</span>
      </div>
      <p style="margin-bottom:16px;color:#4b5563;font-size:15px;line-height:1.6">
        This code expires in 5 minutes.
      </p>
      <p style="margin-bottom:16px;color:#4b5563;font-size:15px;line-height:1.6">
        If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
      <p style="margin-bottom:0;color:#6b7280;font-size:13px;line-height:1.6">
        Thank you,
        <br />
        The HireBoost AI Team
      </p>
      <p style="margin-top:28px;color:#9ca3af;font-size:12px;line-height:1.5">— HireBoost AI</p>
    </div>
  `;
}

async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const { to, subject, html } = opts;

  const { error } = await resend.emails.send({
    from: "HireBoost AI <support@support.hireboostai.com>",
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendSignupVerificationEmail(opts: { to: string; otp: string; name?: string }): Promise<void> {
  const { to, otp, name } = opts;
  const html = buildSignupVerificationEmailHtml({ name, otp });

  await sendEmail({
    to,
    subject: "Verify Your Email Address – HireBoost AI",
    html,
  });
}

export async function sendPasswordResetEmail(opts: { to: string; otp: string; name?: string }): Promise<void> {
  const { to, otp, name } = opts;
  const html = buildPasswordResetEmailHtml({ name, otp });

  await sendEmail({
    to,
    subject: "Reset Your HireBoost AI Password",
    html,
  });
}

export async function sendOtpEmail(opts: { to: string; otp: string; purpose?: "signup" | "password-reset"; name?: string }): Promise<void> {
  if (opts.purpose === "signup") {
    return sendSignupVerificationEmail(opts);
  }

  return sendPasswordResetEmail(opts);
}