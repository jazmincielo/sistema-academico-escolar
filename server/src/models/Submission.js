import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  { originalName: String, path: String, mimeType: String, size: Number },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },
    file: fileSchema,
    late: { type: Boolean, default: false },
  },
  { timestamps: true }
);

submissionSchema.index({ task: 1, student: 1 }, { unique: true });

export const Submission = mongoose.model('Submission', submissionSchema);
