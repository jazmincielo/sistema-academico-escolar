import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'El nombre de la materia es obligatorio'], trim: true, maxlength: 80 },
    course: { type: String, required: [true, 'El curso es obligatorio'], trim: true, maxlength: 30 },
    year: { type: Number, default: () => new Date().getFullYear(), min: 2000, max: 2100 },
    schedule: { type: String, trim: true, maxlength: 80 },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Debe asignarse un docente'], index: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

subjectSchema.index({ name: 1, course: 1, year: 1 }, { unique: true });
subjectSchema.index({ students: 1 });

export const Subject = mongoose.model('Subject', subjectSchema);
