import mongoose from 'mongoose';

export const PERIODS = ['T1', 'T2', 'T3'];

const gradeSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    period: { type: String, enum: { values: PERIODS, message: 'Periodo inválido (T1, T2, T3)' }, required: true },
    score: {
      type: Number, required: [true, 'La nota es obligatoria'],
      min: [0, 'Nota fuera de rango (0-100)'], max: [100, 'Nota fuera de rango (0-100)'],
    },
    comment: { type: String, trim: true, maxlength: 300 },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Una sola nota por estudiante / materia / periodo
gradeSchema.index({ student: 1, subject: 1, period: 1 }, { unique: true });
gradeSchema.index({ subject: 1, period: 1 });

export const Grade = mongoose.model('Grade', gradeSchema);
