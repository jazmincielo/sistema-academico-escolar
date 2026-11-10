import { Attendance, ATTENDANCE_STATUS } from '../models/Attendance.js';
import { Justification } from '../models/Justification.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertId, parseDay } from '../utils/helpers.js';
import { assertCanViewStudent, loadOwnedSubject, studentScope, visibleSubjectIds } from '../services/access.js';
import { getAttendanceSummary } from '../services/academic.js';
import { notifyUsers } from '../services/notify.js';
import { User } from '../models/User.js';

// GET /api/attendance/sheet?subject=&date=  → lista del día con el estado ya registrado (por defecto "presente")
export const attendanceSheet = asyncHandler(async (req, res) => {
  const subject = await loadOwnedSubject(req.user, req.query.subject);
  const date = parseDay(req.query.date);
  await subject.populate('students', 'name');
  const records = await Attendance.find({ subject: subject._id, date });
  const rows = subject.students.sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({
    student: { _id: s._id, name: s.name },
    status: records.find((r) => r.student.equals(s._id))?.status ?? 'presente',
    recorded: records.some((r) => r.student.equals(s._id)),
  }));
  res.json({ subject: { _id: subject._id, name: subject.name, course: subject.course }, date: req.query.date, rows });
});

// POST /api/attendance/bulk  (RF-005)
export const saveAttendance = asyncHandler(async (req, res) => {
  const { subject: subjectId, date: dateStr, records } = req.body;
  const subject = await loadOwnedSubject(req.user, subjectId);
  const date = parseDay(dateStr);
  if (!Array.isArray(records) || !records.length) throw new ApiError(400, '"records" debe ser un arreglo no vacío');
  const enrolled = new Set(subject.students.map(String));
  const bad = records.filter((r) => !enrolled.has(String(r.student)) || !ATTENDANCE_STATUS.includes(r.status) || r.status === 'justificada');
  if (bad.length) throw new ApiError(400, 'Registros inválidos: estudiante no matriculado o estado no permitido (presente, ausente, tardanza)');

  // No pisar una falta ya justificada
  const justified = new Set((await Attendance.find({ subject: subject._id, date, status: 'justificada' }).select('student')).map((a) => String(a.student)));
  const toSave = records.filter((r) => !justified.has(String(r.student)));

  await Attendance.bulkWrite(toSave.map((r) => ({
    updateOne: {
      filter: { student: r.student, subject: subject._id, date },
      update: { $set: { status: r.status, recordedBy: req.user._id } },
      upsert: true,
    },
  })));

  const absent = toSave.filter((r) => r.status === 'ausente').map((r) => r.student);
  if (absent.length) {
    User.find({ role: 'apoderado', children: { $in: absent } }).select('_id').then((gs) =>
      notifyUsers(gs.map((g) => g._id), {
        title: 'Inasistencia registrada',
        message: `Su representado fue marcado ausente en ${subject.name} el ${dateStr}. Puede solicitar la justificación desde el módulo de Asistencia.`,
        type: 'asistencia',
      }));
  }
  res.json({ message: 'Asistencia guardada', saved: toSave.length, skippedJustified: records.length - toSave.length });
});

// GET /api/attendance?student=&subject=&from=&to=
export const listAttendance = asyncHandler(async (req, res) => {
  const { student, subject, from, to } = req.query;
  const filter = {};
  const scope = studentScope(req.user);
  if (scope) filter.student = { $in: scope };
  else filter.subject = { $in: await visibleSubjectIds(req.user) };
  if (student) { await assertCanViewStudent(req.user, student); filter.student = student; }
  if (subject) { assertId(subject, 'subject'); filter.subject = subject; }
  if (from || to) filter.date = { ...(from && { $gte: parseDay(from, 'from') }), ...(to && { $lte: parseDay(to, 'to') }) };

  const items = await Attendance.find(filter).populate('subject', 'name course').populate('student', 'name').sort({ date: -1 }).limit(300).lean();
  const js = await Justification.find({ attendance: { $in: items.map((i) => i._id) } }).sort({ createdAt: 1 }).select('attendance status ticket');
  const latest = new Map(js.map((j) => [String(j.attendance), j])); // la última solicitud gana
  res.json({ items: items.map((i) => ({ ...i, justification: latest.get(String(i._id)) || null })) });
});

// GET /api/attendance/summary/:studentId
export const attendanceSummary = asyncHandler(async (req, res) => {
  await assertCanViewStudent(req.user, req.params.studentId);
  res.json(await getAttendanceSummary(req.params.studentId));
});
