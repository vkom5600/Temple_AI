import nodemailer from "nodemailer";
import pool from "../config/db.js";

// Sends email through SMTP when SMTP_HOST is set in .env.
// Without it (development), each email is printed to the terminal instead.
// Never throws: a failed email must not break the main operation.

const smtpConfigured = Boolean(process.env.SMTP_HOST);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    })
  : null;

const FROM = process.env.EMAIL_FROM || "Temple AI <no-reply@temple.local>";

export const sendEmail = async ({ to, subject, text }) => {
  const recipients = [].concat(to).filter(Boolean);
  if (!recipients.length) return false;

  if (!transporter) {
    console.log(
      `\n----- EMAIL (console mode: set SMTP_HOST to send for real) -----\n` +
      `To: ${recipients.join(", ")}\nSubject: ${subject}\n\n${text}\n` +
      `----------------------------------------------------------------\n`
    );
    return true;
  }

  try {
    await transporter.sendMail({ from: FROM, to: recipients, subject, text });
    return true;
  } catch (error) {
    console.error(`Email failed (${subject}):`, error.message);
    return false;
  }
};

// Email addresses of active chairmen (usually one).
export const chairmanEmails = async () => {
  const result = await pool.query(
    `SELECT email FROM users
     WHERE role = 'chairman' AND is_active AND approval_status = 'approved'`
  );
  return result.rows.map((row) => row.email);
};
