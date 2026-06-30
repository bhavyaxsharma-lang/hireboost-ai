import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtpEmail(opts: {
  to: string;
  otp: string;
}): Promise<void> {
  const { to, otp } = opts;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2>Reset your HireBoost AI password</h2>

      <p>
        Use the OTP below to reset your password.
        It is valid for <strong>5 minutes</strong>.
      </p>

      <div style="
        background:#f3f4f6;
        padding:24px;
        text-align:center;
        border-radius:10px;
        margin:20px 0;
      ">
        <span style="
          font-size:38px;
          font-weight:bold;
          letter-spacing:10px;
          color:#2563eb;
        ">
          ${otp}
        </span>
      </div>

      <p>If you didn't request this password reset, simply ignore this email.</p>

      <p style="color:#888;font-size:12px">
        — HireBoost AI
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
  from: "HireBoost AI <support@support.hireboostai.com>",
    to,
    subject: "Reset Your HireBoost AI Password",
    html,
  });

  if (error) {
    console.error(error);
    throw new Error(error.message);
  }

  console.log("OTP email sent successfully");
}