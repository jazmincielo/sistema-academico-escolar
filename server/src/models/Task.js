import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    title: { type: String, required: [true, 'El título es obligatorio'], trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    dueDate: { type: Date, required: [true, 'La fecha límite es obligatoria'] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

taskSchema.index({ subject: 1, dueDate: 1 });

export const Task = mongoose.model('Task', taskSchema);
