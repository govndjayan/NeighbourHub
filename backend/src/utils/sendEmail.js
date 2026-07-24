const nodemailer = require('nodemailer');

/**
 * Sends an email using SMTP credentials from environment variables.
 * Required env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Optional:
 *   SMTP_FROM   (defaults to SMTP_USER)
 *   SMTP_SECURE ("true" to force TLS on port 465)
 */
const buildTransporter = () => {
  const port = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendEmail = async ({ to, subject, text, html }) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Email service is not configured. Please set SMTP_* environment variables.');
  }
  const transporter = buildTransporter();
  const from = process.env.SMTP_FROM || `Eaze Apt <${process.env.SMTP_USER}>`;
  await transporter.sendMail({ from, to, subject, text, html });
};

/**
 * Builds a branded OTP email for password reset.
 */
const otpEmailTemplate = (name, otp) => {
  const safeName = name || 'Neighbour';
  return {
    subject: 'Your Eaze Apt password reset code',
    text: `Hi ${safeName},\n\nYour password reset code is ${otp}. It expires in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.\n\n— Eaze Apt`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#07231f;border-radius:16px;color:#e6fffa;">
        <h2 style="margin:0 0 4px;color:#fff;">Eaze Apt</h2>
        <p style="margin:0 0 24px;color:#5eead4;font-size:12px;letter-spacing:1px;">YOUR COMMUNITY · CONNECTED</p>
        <p style="color:#cbd5e1;">Hi ${safeName},</p>
        <p style="color:#cbd5e1;">Use the code below to reset your password. It expires in <strong>10 minutes</strong>.</p>
        <div style="margin:24px 0;padding:18px;text-align:center;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.3);border-radius:12px;">
          <span style="font-size:34px;font-weight:800;letter-spacing:10px;color:#34d399;">${otp}</span>
        </div>
        <p style="color:#94a3b8;font-size:13px;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  };
};

module.exports = { sendEmail, otpEmailTemplate };
