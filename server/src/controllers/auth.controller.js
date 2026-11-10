import crypto from 'node:crypto';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signToken } from '../utils/token.js';
import { sendMail } from '../services/mailer.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const needEmail = (email) => {
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) throw new ApiError(400, 'Correo electrónico inválido');
  return email.trim().toLowerCase();
};
const session = (user) => ({ token: signToken(user), expiresIn: env.jwtExpiresIn, user });

// POST /api/auth/register  (RF-001) — registro público: solo estudiante o apoderado
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'estudiante' } = req.body;
  if (!['estudiante', 'apoderado'].includes(role)) {
    throw new ApiError(403, 'El registro público solo permite los roles estudiante o apoderado');
  }
  if (typeof password !== 'string' || password.length < 8) throw new ApiError(400, 'La contraseña debe tener al menos 8 caracteres');
  const user = await User.create({ name, email: needEmail(email), password, role });
  res.status(201).json(session(user));
});

// POST /api/auth/login  (correo + contraseña)
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Correo y contraseña son obligatorios');
  const user = await User.findOne({ email: needEmail(email) }).select('+password');
  // Mismo mensaje para usuario inexistente o clave errónea: no revela qué cuentas existen
  if (!user || !user.active || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Credenciales inválidas');
  }
  user.lastLogin = new Date();
  await user.save();
  res.json(session(user));
});

// POST /api/auth/otp/request  (UC-01 pasos 1-2)
export const requestOtp = asyncHandler(async (req, res) => {
  const email = needEmail(req.body.email);
  const user = await User.findOne({ email, active: true });
  if (!user) throw new ApiError(404, 'Usuario no encontrado en la base de datos'); // flujo A2 del UC-01

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  user.otp = { codeHash: sha256(`${user._id}:${code}`), expiresAt: new Date(Date.now() + env.otpTtlMinutes * 60_000), attempts: 0 };
  await user.save({ validateBeforeSave: false });

  await sendMail({
    to: user.email,
    subject: 'Su código de acceso',
    text: `Su código de verificación es ${code}. Expira en ${env.otpTtlMinutes} minutos. Si no lo solicitó, ignore este mensaje.`,
  });
  res.json({ message: 'Código enviado al correo institucional', expiresInMinutes: env.otpTtlMinutes, ...(env.exposeDevOtp ? { devCode: code } : {}) });
});

// POST /api/auth/otp/verify  (UC-01 pasos 3-4)
export const verifyOtp = asyncHandler(async (req, res) => {
  const email = needEmail(req.body.email);
  const code = String(req.body.code || '');
  const user = await User.findOne({ email, active: true }).select('+otp');
  const invalid = new ApiError(400, 'Código inválido o expirado'); // flujo A1

  if (!user || !user.otp?.codeHash || user.otp.expiresAt < new Date() || user.otp.attempts >= 5) throw invalid;

  const expected = Buffer.from(user.otp.codeHash);
  const given = Buffer.from(sha256(`${user._id}:${code}`));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    user.otp.attempts += 1;
    await user.save({ validateBeforeSave: false });
    throw invalid;
  }
  user.otp = undefined; // el código es de un solo uso
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });
  res.json(session(user));
});

// GET /api/auth/me  (RF-002)
export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('children', 'name email course');
  res.json({ user });
});
