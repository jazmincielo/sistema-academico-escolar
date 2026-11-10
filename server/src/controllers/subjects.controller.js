import { Subject } from '../models/Subject.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertId } from '../utils/helpers.js';
import { studentScope } from '../services/access.js';

async function validateRefs({ teacher, students }) {
  if (teacher !== undefined) {
    assertId(teacher, 'teacher');
    if (!(await User.exists({ _id: teacher, role: 'docente', active: true }))) throw new ApiError(400, 'El docente indicado no existe o no tiene rol docente');
  }
  if (students !== undefined) {
    if (!Array.isArray(students)) throw new ApiError(400, '"students" debe ser un arreglo');
    students.forEach((s) => assertId(s, 'students'));
    const n = await User.countDocuments({ _id: { $in: students }, role: 'estudiante' });
    if (n !== new Set(students.map(String)).size) throw new ApiError(400, 'Todos los estudiantes matriculados deben tener rol estudiante');
  }
}

// GET /api/subjects  — filtrado automático por rol
export const listSubjects = asyncHandler(async (req, res) => {
  const u = req.user;
  const filter = {};
  if (u.role === 'docente') filter.teacher = u._id;
  else if (studentScope(u)) filter.students = { $in: studentScope(u) };
  if (req.query.course) filter.course = req.query.course;
  const items = await Subject.find(filter).populate('teacher', 'name').sort({ course: 1, name: 1 });
  res.json({ items: items.map((s) => ({ ...s.toJSON(), studentCount: s.students.length, students: u.role === 'administrador' ? s.students : undefined })) });
});

// GET /api/subjects/:id
export const getSubject = asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const s = await Subject.findById(req.params.id).populate('teacher', 'name').populate('students', 'name email course');
  if (!s) throw new ApiError(404, 'Materia no encontrada');
  const u = req.user;
  const allowed = u.role === 'administrador' || (u.role === 'docente' && s.teacher._id.equals(u._id)) ||
    (studentScope(u) && s.students.some((st) => studentScope(u).some((id) => id.equals(st._id))));
  if (!allowed) throw new ApiError(403, 'No tiene acceso a esta materia');
  res.json({ subject: s });
});

// POST /api/subjects
export const createSubject = asyncHandler(async (req, res) => {
  const { name, course, year, schedule, teacher, students = [] } = req.body;
  await validateRefs({ teacher, students });
  const subject = await Subject.create({ name, course, year, schedule, teacher, students });
  res.status(201).json({ subject });
});

// PUT /api/subjects/:id
export const updateSubject = asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const subject = await Subject.findById(req.params.id);
  if (!subject) throw new ApiError(404, 'Materia no encontrada');
  const { name, course, year, schedule, teacher, students } = req.body;
  await validateRefs({ teacher, students });
  Object.entries({ name, course, year, schedule, teacher, students }).forEach(([k, v]) => { if (v !== undefined) subject[k] = v; });
  await subject.save();
  res.json({ subject });
});

// DELETE /api/subjects/:id
export const deleteSubject = asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const subject = await Subject.findByIdAndDelete(req.params.id);
  if (!subject) throw new ApiError(404, 'Materia no encontrada');
  res.status(204).end();
});
