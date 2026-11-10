import mongoose from 'mongoose';

export const ATTENDANCE_STATUS = ['presente', 'ausente', 'tardanza', 'justificada'];

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: { values: ATTENDANCE_STATUS, message: 'Estado de asistencia inválido' }, required: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

attendanceSchema.index({ student: 1, subject: 1, date: 1 }, { unique: true });
attendanceSchema.index({ subject: 1, date: 1 });
attendanceSchema.index({ student: 1, status: 1 });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
