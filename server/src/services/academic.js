import { Subject } from '../models/Subject.js';
import { Grade } from '../models/Grade.js';
import { Attendance } from '../models/Attendance.js';
import { avg } from '../utils/helpers.js';

/** Boletín: notas por materia y trimestre + promedios. Escala 0-100. */
export async function getBulletin(studentId) {
  const subjects = await Subject.find({ students: studentId }).populate('teacher', 'name').sort({ name: 1 });
  const grades = await Grade.find({ student: studentId, subject: { $in: subjects.map((s) => s._id) } });
  const rows = subjects.map((s) => {
    const mine = grades.filter((g) => g.subject.equals(s._id));
    const byPeriod = (p) => mine.find((g) => g.period === p)?.score ?? null;
    const scores = mine.map((g) => g.score);
    return {
      subject: { _id: s._id, name: s.name, course: s.course, teacher: s.teacher?.name },
      T1: byPeriod('T1'), T2: byPeriod('T2'), T3: byPeriod('T3'),
      average: avg(scores),
    };
  });
  return { rows, generalAverage: avg(rows.map((r) => r.average).filter((v) => v !== null)) };
}

/** Resumen de asistencia: porcentaje (presente+tardanza+justificada) y faltas sin justificar. */
export async function getAttendanceSummary(studentId) {
  const records = await Attendance.find({ student: studentId }).select('status');
  const total = records.length;
  const count = (st) => records.filter((r) => r.status === st).length;
  const attended = count('presente') + count('tardanza') + count('justificada');
  return {
    total,
    presente: count('presente'), tardanza: count('tardanza'), justificada: count('justificada'), ausente: count('ausente'),
    percentage: total ? Math.round((attended / total) * 100) : null,
    unjustified: count('ausente'),
  };
}
