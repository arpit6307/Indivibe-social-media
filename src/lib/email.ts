import nodemailer from 'nodemailer';

// SMTP Configuration from env
const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpFrom = process.env.SMTP_FROM || 'IndiVibe <no-reply@patr.in>';

// Create transporter
const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465, // true for 465, false for other ports
  auth: smtpUser && smtpPass ? {
    user: smtpUser,
    pass: smtpPass
  } : undefined
});

export async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text: string; html?: string }) {
  // If SMTP is not configured, fallback to console log
  if (!smtpHost || !smtpUser) {
    console.log(`\n======================================================`);
    console.log(`[SMTP MOCK EMAIL SENDER]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${text}`);
    console.log(`======================================================\n`);
    return { mock: true, success: true };
  }

  try {
    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text,
      html
    });
    console.log(`Email sent: ${info.messageId}`);
    return { mock: false, success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email via SMTP:", error);
    return { mock: false, success: false, error };
  }
}
