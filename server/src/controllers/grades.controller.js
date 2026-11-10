import { Grade, PERIODS } from '../models/Grade.js';
import { Subject } from '../models/Subject.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertId } from '../utils/helpers.js';
import { assertCanViewStudent, loadOwnedSubject, studentScope, visibleSubjectIds } from '../services/access.js';
import { getBulletin } from '../services/academic.js';
import { notifyUsers, studentsAndGuardians } from '../services/notify.js';

const needPeriod = (p) => {
  if (!PERIODS.includes(p)) throw new ApiError(400, `Periodo inválido. Use: ${PERIODS.join(', ')}`);
  return p;
};

// GET /api/grades?subject=&period=&student=
export const listGrades = asyncHandler(async (req, res) => {
  const { subject, period, student } = req.query;
  const filter = {};
  const scope = studentScope(req.user);
  if (scope) filter.student = { $in: scope };
  else filter.subject = { $in: await visibleSubjectIds(req.user) };
  if (student) { await assertCanViewStudent(req.user, student); filter.student = student; }
  if (subject) { assertId(subject, 'subject'); filter.subject = subject; }
  if (period) filter.period = needPeriod(period);
  const items = await Grade.find(filter).populate('subject', 'name course').populate('student', 'name').sort({ period: 1 });
  res.json({ items });
});

// GET /api/grades/sheet?subject=&period=  → planilla del docente (todos los matriculados, con o sin nota)
export const gradeSheet = asyncHandler(async (req, res) => {
  const subject = await loadOwnedSubject(req.user, req.query.subject);
  const period = needPeriod(req.query.period);
  await subject.populate('students', 'name');
  const grades = await Grade.find({ subject: subject._id, period });
  const rows = subject.students
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => {
      const g = grades.find((x) => x.student.equals(s._id));
      return { student: { _id: s._id, name: s.name }, score: g?.score ?? null, comment: g?.comment ?? '' };
    });
  res.json({ subject: { _id: subject._id, name: subject.name, course: subject.course }, period, rows });
});

// PUT /api/grades/bulk  (UC-03 "Guardar y Publicar") — upsert idempotente
export const saveGrades = asyncHandler(async (req, res) => {
  const { subject: subjectId, period, grades } = req.body;
  const subject = await loadOwnedSubject(req.user, subjectId);
  needPeriod(period);
  if (!Array.isArray(grades) || !grades.length) throw new ApiError(400, '"grades" debe ser un arreglo no vacío');

  const enrolled = new Set(subject.students.map(String));
  const errors = [];
  grades.forEach((g, i) => {
    if (!enrolled.has(String(g.student))) errors.push({ index: i, message: 'El estudiante no está matriculado en la materia' });
    else if (typeof g.score !== 'number' || Number.isNaN(g.score) || g.score < 0 || g.score > 100) {
      errors.push({ index: i, student: g.student, message: 'Nota fuera de rango (0-100)' }); // flujo A1
    }
  });
  if (errors.length) throw new ApiError(400, 'Hay notas inválidas; no se guardó ningún cambio', errors);

  await Grade.bulkWrite(grades.map((g) => ({
    updateOne: {
      filter: { student: g.student, subject: subject._id, period },
      update: { $set: { score: g.score, comment: g.comment || '', teacher: req.user._id } },
      upsert: true,
    },
  })));

  // Notificación automática a estudiantes y apoderados (RF-006) — sin bloquear la respuesta
  studentsAndGuardians(grades.map((g) => g.student)).then((ids) =>
    notifyUsers(ids, {
      title: `Calificaciones actualizadas: ${subject.name}`,
      message: `Se publicaron las calificaciones de ${subject.name} (${subject.course}) para el periodo ${period}.`,
      type: 'calificacion',
    }));

  res.json({ message: 'Calificaciones guardadas y publicadas', saved: grades.length });
});

// DELETE /api/grades/:id
export const deleteGrade = asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const grade = await Grade.findById(req.params.id);
  if (!grade) throw new ApiError(404, 'Calificación no encontrada');
  await loadOwnedSubject(req.user, grade.subject);
  await grade.deleteOne();
  res.status(204).end();
});

// GET /api/grades/bulletin/:studentId
export const bulletin = asyncHandler(async (req, res) => {
  await assertCanViewStudent(req.user, req.params.studentId);
  res.json(await getBulletin(req.params.studentId));
});
