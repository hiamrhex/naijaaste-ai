import nodemailer from 'nodemailer';

// ─── Email delivery (SMTP via nodemailer) ───────────────────────────────────
// Requires SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS (see .env.example).
// Dev fallback: when SMTP is not configured (or delivery fails outside prod),
// the OTP is console-logged and returned as `dev_otp` so local flows still work.
// Production NEVER returns dev_otp.

const FROM = process.env.SMTP_FROM || 'NaijaTaste AI <noreply@localhost>';

const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

const otpHtml = ({ name, code }) => `
<div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#080810;padding:32px 16px;color:#F9FAFB">
  <div style="max-width:420px;margin:0 auto;background:#111827;border:1px solid #1F2937;border-radius:16px;padding:32px 28px">
    <div style="font-weight:800;font-size:18px;letter-spacing:-0.3px;margin-bottom:4px">
      NaijaTaste <span style="color:#F97316">AI</span>
    </div>
    <p style="font-size:14px;color:#9CA3AF;line-height:1.6;margin:16px 0 8px">
      Hi ${name || 'there'}, someone requested a password reset for your account.
      Use the code below within 10 minutes:
    </p>
    <div style="background:#0D0D1A;border:1px solid #1F2937;border-radius:12px;padding:20px;text-align:center;margin:16px 0">
      <span style="font-family:ui-monospace,'Cascadia Mono',monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#F97316">${code}</span>
    </div>
    <p style="font-size:13px;color:#6B7280;line-height:1.6;margin:0">
      This code expires in 10 minutes and can be used 5 times max.
      If you didn't request this, ignore this email — your password is unchanged.
    </p>
  </div>
</div>`;

/**
 * Send a password-reset OTP email over SMTP.
 * Returns { delivered: boolean, dev_otp?: string }.
 * dev_otp is only ever set outside production.
 */
export const sendOtpEmail = async ({ to, name, code }) => {
  const isProd = process.env.NODE_ENV === 'production';

  if (!smtpConfigured()) {
    console.log(`[email] SMTP not configured — OTP for ${to}: ${code}`);
    return { delivered: false, ...(isProd ? {} : { dev_otp: code }) };
  }

  try {
    await getTransporter().sendMail({
      from: FROM,
      to,
      subject: 'Your NaijaTaste AI reset code',
      html: otpHtml({ name, code }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[email] SMTP delivery failed:', err.message);
    if (isProd) return { delivered: false };
    return { delivered: false, dev_otp: code };
  }
};
