import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host, port: env.smtp.port, secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

/** Envía un correo por SMTP. Sin SMTP configurado (desarrollo) lo imprime en consola. */
export async function sendMail({ to, subject, text }) {
  if (!transporter) {
    if (!env.isTest) console.log(`📧 [MAIL simulado] Para: ${to} | Asunto: ${subject}\n${text}\n`);
    return;
  }
  await transporter.sendMail({ from: env.smtp.from, to, subject, text });
}
