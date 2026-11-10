import mongoose from 'mongoose';

export const REASONS = ['Salud', 'Familiar', 'Fuerza Mayor'];
export const JUSTIFICATION_STATUS = ['Pendiente', 'Aprobada', 'Rechazada'];

const justificationSchema = new mongoose.Schema(
  {
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    guardian: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: { values: REASONS, message: 'Motivo inválido' }, required: true },
    detail: { type: String, trim: true, maxlength: 500, default: '' },
    file: { originalName: String, path: String, mimeType: String, size: Number },
    status: { type: String, enum: JUSTIFICATION_STATUS, default: 'Pendiente' },
    ticket: { type: String, unique: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

// Solo puede existir una solicitud vigente (Pendiente/Aprobada) por inasistencia (UC-08, flujo A2)
justificationSchema.index(
  { attendance: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['Pendiente', 'Aprobada'] } } }
);
justificationSchema.index({ status: 1, createdAt: -1 });
justificationSchema.index({ guardian: 1 });

export const Justification = mongoose.model('Justification', justificationSchema);
