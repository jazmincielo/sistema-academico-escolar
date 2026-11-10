import { User } from '../models/User.js';
import { Subject } from '../models/Subject.js';
import { Grade } from '../models/Grade.js';
import { Task } from '../models/Task.js';
import { Submission } from '../models/Submission.js';
import { Justification } from '../models/Justification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { avg } from '../utils/helpers.js';
import { getAttendanceSummary, getBulletin } from '../services/academic.js';

async function studentCard(student) {
  const [bulletin, att, subjects] = await Promise.all([getBulletin(student._id), getAttendanceSummary(student._id), Subject.find({ students: student._id }).select('_id')]);
  const tasks = await Task.find({ subject: { $in: subjects.map((s) => s._id) }, dueDate: { $gte: new Date() } }).select('_id');
  const done = await Submission.countDocuments({ student: student._id, task: { $in: tasks.map((t) => t._id) } });
  return {
    student: { _id: student._id, name: student.name, course: student.course },
    generalAverage: bulletin.generalAverage, attendance: att.percentage, unjustified: att.unjustified,
    subjects: subjects.length, pendingTasks: tasks.length - done,
  };
}

// GET /api/dashboard  (RF-003) — métricas adaptadas al rol
export const dashboard = asyncHandler(async (req, res) => {
  const u = req.user;

  if (u.role === 'administrador') {
    const [byRole, pendingJustifications, inactive, subjects] = await Promise.all([
      User.aggregate([{ $group: { _id: '$role', total: { $sum: 1 } } }]),
      Justification.countDocuments({ status: 'Pendiente' }),
      User.countDocuments({ active: false }),
      Subject.countDocuments(),
    ]);
    return res.json({ role: u.role, users: Object.fromEntries(byRole.map((r) => [r._id, r.total])), pendingJustifications, inactive, subjects });
  }

  if (u.role === 'docente') {
    const subjects = await Subject.find({ teacher: u._id }).select('name course students');
    const ids = subjects.map((s) => s._id);
    const [grades, tasks] = await Promise.all([
      Grade.find({ subject: { $in: ids } }).select('score subject'),
      Task.find({ subject: { $in: ids }, dueDate: { $gte: new Date() } }).select('title dueDate subject').sort({ dueDate: 1 }).limit(5).populate('subject', 'name'),
    ]);
    return res.json({
      role: u.role,
      subjects: subjects.map((s) => ({ _id: s._id, name: s.name, course: s.course, students: s.students.length, average: avg(grades.filter((g) => g.subject.equals(s._id)).map((g) => g.score)) })),
      totalStudents: new Set(subjects.flatMap((s) => s.students.map(String))).size,
      generalAverage: avg(grades.map((g) => g.score)),
      upcomingTasks: tasks,
    });
  }

  if (u.role === 'estudiante') return res.json({ role: u.role, ...(await studentCard(u)) });

  // apoderado
  const children = await User.find({ _id: { $in: u.children } }).select('name course');
  const unreadJustifications = await Justification.countDocuments({ guardian: u._id, status: 'Pendiente' });
  res.json({ role: u.role, children: await Promise.all(children.map(studentCard)), pendingJustifications: unreadJustifications });
});
