import dotenv from 'dotenv';
dotenv.config();

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

if (isTest) {
  process.env.JWT_SECRET ||= 'test_secret_test_secret_test_secret_123456';
  process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/sae_test';
}

if (!process.env.JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en las variables de entorno (.env)');
}
if (isProd && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
}

export const env = {
  isProd,
  isTest,
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sistema_academico',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  // El enunciado exige salt factor >= 10
  saltRounds: Math.max(10, Number(process.env.BCRYPT_SALT_ROUNDS) || 10),
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES) || 3,
  exposeDevOtp: !isProd && process.env.EXPOSE_DEV_OTP === 'true',
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'Sistema Académico Escolar <no-reply@colegio.edu>',
  },
};
