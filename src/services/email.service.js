import nodemailer from 'nodemailer';
import { logger } from '../lib/logger.js';
import { env } from '../env.js';

// ─── Email delivery (SMTP via nodemailer) ───────────────────────────────────
// Requires SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS (see .env.example).
// Dev fallback: when SMTP is not configured (or delivery fails outside prod),
// the OTP is console-logged and returned as `dev_otp` so local flows still work.
// Production NEVER returns dev_otp.

const FROM = env.SMTP_FROM || 'NaijaTaste AI <noreply@localhost>';

// User-controlled display names are interpolated into HTML mail — escape
// every interpolated value at the template boundary (stored-XSS defense).
export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const otpHtml = ({ name, code }) => `
<div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#080810;padding:32px 16px;color:#F9FAFB">
  <div style="max-width:420px;margin:0 auto;background:#111827;border:1px solid #1F2937;border-radius:16px;padding:32px 28px">
    <div style="font-weight:800;font-size:18px;letter-spacing:-0.3px;margin-bottom:4px">
      NaijaTaste <span style="color:#F97316">AI</span>
    </div>
    <p style="font-size:14px;color:#9CA3AF;line-height:1.6;margin:16px 0 8px">
      Hi ${escapeHtml(name) || 'there'}, someone requested a password reset for your account.
      Use the code below within 10 minutes:
    </p>
    <div style="background:#0D0D1A;border:1px solid #1F2937;border-radius:12px;padding:20px;text-align:center;margin:16px 0">
      <span style="font-family:ui-monospace,'Cascadia Mono',monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#F97316">${escapeHtml(code)}</span>
    </div>
    <p style="font-size:13px;color:#6B7280;line-height:1.6;margin:0">
      This code expires in 10 minutes and can be used 5 times max.
      If you didn't request this, ignore this email — your password is unchanged.
    </p>
  </div>
</div>`;

const smtpConfigured = () =>
  Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    const port = env.SMTP_PORT || 587;
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
};

/**
 * Send a password-reset OTP email over SMTP.
 * Returns { delivered: boolean, dev_otp?: string }.
 * dev_otp is only ever set outside production.
 */
export const sendOtpEmail = async ({ to, name, code }) => {
  const isProd = env.NODE_ENV === 'production';
  // dev_otp exists ONLY on explicit opt-in outside production — never on
  // SMTP failure alone (plan 008: misconfigured deploys must not leak codes).
  const devOtpAllowed = env.DEV_OTP_ENABLED === 'true' && !isProd;

  if (!smtpConfigured()) {
    if (isProd) {
      logger.warn('smtp not configured — otp email skipped in production');
      return { delivered: false };
    }
    logger.warn('smtp not configured — dev otp fallback (code withheld from logs)');
    return devOtpAllowed ? { delivered: false, dev_otp: code } : { delivered: false };
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
    logger.error({ err }, 'smtp delivery failed');
    if (isProd) return { delivered: false };
    return devOtpAllowed ? { delivered: false, dev_otp: code } : { delivered: false };
  }
};
