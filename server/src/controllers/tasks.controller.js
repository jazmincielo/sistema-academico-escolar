import { Task } from '../models/Task.js';
import { Submission } from '../models/Submission.js';
import { Subject } from '../models/Subject.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertId } from '../utils/helpers.js';
import { loadOwnedSubject, studentScope, visibleSubjectIds, assertCanViewStudent } from '../services/access.js';
import { toFileInfo, filePath } from '../middlewares/upload.js';
import { notifyUsers } from '../services/notify.js';

async function loadOwnedTask(user, id) {
  assertId(id, 'task');
  const task = await Task.findById(id);
  if (!task) throw new ApiError(404, 'Tarea no encontrada');
  await loadOwnedSubject(user, task.subject);
  return task;
}

// GET /api/tasks?subject=&student=&pending=true
export const listTasks = asyncHandler(async (req, res) => {
  const filter = { subject: { $in: await visibleSubjectIds(req.user) } };
  if (req.query.subject) { assertId(req.query.subject, 'subject'); filter.subject = req.query.subject; }
  const tasks = await Task.find(filter).populate('subject', 'name course').sort({ dueDate: 1 }).lean();

  // Estado de entrega para el estudiante (o el hijo indicado por el apoderado)
  let studentId = req.user.role === 'estudiante' ? req.user._id : null;
  if (req.user.role === 'apoderado') {
    studentId = req.query.student || req.user.children[0];
    if (studentId) await assertCanViewStudent(req.user, studentId);
  }
  let subs = [];
  if (studentId) subs = await Submission.find({ student: studentId, task: { $in: tasks.map((t) => t._id) } }).select('task late createdAt file.originalName');
  const items = tasks.map((t) => {
    const s = subs.find((x) => String(x.task) === String(t._id));
    return { ...t, ...(studentId ? { submission: s || null, overdue: !s && new Date(t.dueDate) < new Date() } : {}) };
  });
  res.json({ items: req.query.pending === 'true' && studentId ? items.filter((t) => !t.submission) : items });
});

// POST /api/tasks  (RF-007)
export const createTask = asyncHandler(async (req, res) => {
  const { subject: subjectId, title, description, dueDate } = req.body;
  const subject = await loadOwnedSubject(req.user, subjectId);
  const task = await Task.create({ subject: subject._id, title, description, dueDate, createdBy: req.user._id });
  notifyUsers(subject.students, { title: `Nueva tarea: ${title}`, message: `${subject.name}: ${title}. Fecha límite ${new Date(task.dueDate).toLocaleDateString('es-BO')}.`, type: 'tarea', email: false });
  res.status(201).json({ task });
});

// PUT /api/tasks/:id
export const updateTask = asyncHandler(async (req, res) => {
  const task = await loadOwnedTask(req.user, req.params.id);
  ['title', 'description', 'dueDate'].forEach((k) => { if (req.body[k] !== undefined) task[k] = req.body[k]; });
  await task.save();
  res.json({ task });
});

// DELETE /api/tasks/:id
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await loadOwnedTask(req.user, req.params.id);
  await Promise.all([task.deleteOne(), Submission.deleteMany({ task: task._id })]);
  res.status(204).end();
});

// POST /api/tasks/:id/submissions  (RF-008) multipart: file (opcional) + comment
export const submitTask = asyncHandler(async (req, res) => {
  assertId(req.params.id, 'task');
  const task = await Task.findById(req.params.id);
  if (!task) throw new ApiError(404, 'Tarea no encontrada');
  if (!(await Subject.exists({ _id: task.subject, students: req.user._id }))) throw new ApiError(403, 'No está matriculado en la materia de esta tarea');
  if (!req.file && !req.body.comment) throw new ApiError(400, 'Adjunte un archivo o escriba un comentario');

  const submission = await Submission.findOneAndUpdate(
    { task: task._id, student: req.user._id },
    { $set: { comment: req.body.comment || '', late: new Date() > task.dueDate, ...(req.file ? { file: toFileInfo(req.file) } : {}) } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ submission });
});

// GET /api/tasks/:id/submissions  (docente titular / admin)
export const listSubmissions = asyncHandler(async (req, res) => {
  const task = await loadOwnedTask(req.user, req.params.id);
  const items = await Submission.find({ task: task._id }).populate('student', 'name').sort({ createdAt: 1 });
  res.json({ task, items });
});

// GET /api/tasks/submissions/:submissionId/file
export const downloadSubmissionFile = asyncHandler(async (req, res) => {
  assertId(req.params.submissionId);
  const sub = await Submission.findById(req.params.submissionId);
  if (!sub?.file?.path) throw new ApiError(404, 'Archivo no encontrado');
  if (req.user.role === 'estudiante' && !sub.student.equals(req.user._id)) throw new ApiError(403, 'Acceso denegado');
  if (req.user.role === 'docente') await loadOwnedSubject(req.user, (await Task.findById(sub.task)).subject);
  res.download(filePath(sub.file.path), sub.file.originalName);
});

export { studentScope };
