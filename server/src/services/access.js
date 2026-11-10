import { Subject } from '../models/Subject.js';
import { ApiError } from '../utils/ApiError.js';
import { assertId } from '../utils/helpers.js';

/** Estudiantes cuya información puede ver el usuario (null = sin restricción por estudiante). */
export function studentScope(user) {
  if (user.role === 'estudiante') return [user._id];
  if (user.role === 'apoderado') return user.children;
  return null;
}

export async function assertCanViewStudent(user, studentId) {
  assertId(studentId, 'student');
  const ok =
    user.role === 'administrador' ||
    (user.role === 'estudiante' && user._id.equals(studentId)) ||
    (user.role === 'apoderado' && user.children.some((c) => c.equals(studentId))) ||
    (user.role === 'docente' && (await Subject.exists({ teacher: user._id, students: studentId })));
  if (!ok) throw new ApiError(403, 'No tiene permiso para ver la información de este estudiante');
}

/** Carga la materia y verifica que el docente sea su titular (el administrador siempre puede). */
export async function loadOwnedSubject(user, subjectId) {
  assertId(subjectId, 'subject');
  const subject = await Subject.findById(subjectId);
  if (!subject) throw new ApiError(404, 'Materia no encontrada');
  if (user.role === 'docente' && !subject.teacher.equals(user._id)) {
    throw new ApiError(403, 'Esta materia no está asignada a su usuario');
  }
  return subject;
}

/** Materias visibles para el usuario según su rol. */
export async function visibleSubjectIds(user) {
  let filter = {};
  if (user.role === 'docente') filter = { teacher: user._id };
  else if (user.role === 'estudiante') filter = { students: user._id };
  else if (user.role === 'apoderado') filter = { students: { $in: user.children } };
  const subjects = await Subject.find(filter).select('_id');
  return subjects.map((s) => s._id);
}
