import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export const ROLES = ['administrador', 'docente', 'estudiante', 'apoderado'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, minlength: [3, 'Nombre muy corto'], maxlength: 100 },
    email: {
      type: String, required: [true, 'El correo es obligatorio'], unique: true, lowercase: true, trim: true,
      match: [EMAIL_RE, 'Correo electrónico inválido'],
    },
    // Hash bcrypt (nunca texto plano). select:false evita filtrarlo en las consultas.
    password: {
      type: String, required: [true, 'La contraseña es obligatoria'], select: false,
      // Texto plano: mínimo 8 caracteres. Un hash bcrypt ($2...) ya viene validado.
      validate: { validator: (v) => v.startsWith('$2') || v.length >= 8, message: 'La contraseña debe tener al menos 8 caracteres' },
    },
    role: { type: String, enum: { values: ROLES, message: 'Rol inválido' }, default: 'estudiante' },
    active: { type: Boolean, default: true },
    course: { type: String, trim: true, maxlength: 30 }, // curso del estudiante (ej. "1ro A")
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // estudiantes a cargo (apoderado)
    otp: {
      type: new mongoose.Schema({ codeHash: String, expiresAt: Date, attempts: { type: Number, default: 0 } }, { _id: false }),
      select: false,
    },
    lastLogin: Date,
  },
  { timestamps: true }
);

userSchema.index({ role: 1, active: 1 });
userSchema.index({ name: 'text' });

userSchema.pre('save', async function (next) {
  if (this.isModified('password') && !this.password.startsWith('$2')) {
    this.password = await bcrypt.hash(this.password, env.saltRounds);
  }
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.otp;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
