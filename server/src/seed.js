// Datos de demostración. Uso: npm run seed   (BORRA las colecciones; no se ejecuta en producción)
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Subject } from './models/Subject.js';
import { Grade } from './models/Grade.js';
import { Attendance } from './models/Attendance.js';
import { Task } from './models/Task.js';
import { Submission } from './models/Submission.js';
import { Justification } from './models/Justification.js';
import { Notification } from './models/Notification.js';

if (env.isProd) { console.error('Seed deshabilitado en producción'); process.exit(1); }

await connectDB();
await Promise.all([User, Subject, Grade, Attendance, Task, Submission, Justification, Notification].map((m) => m.deleteMany({})));
await Promise.all([User, Subject, Grade, Attendance, Task, Submission, Justification, Notification].map((m) => m.syncIndexes()));

const PASSWORD = 'Demo12345';
const mk = (name, email, role, extra = {}) => User.create({ name, email, password: PASSWORD, role, ...extra });

const admin = await mk('Carlos Mendoza', 'carlos@colegio.edu', 'administrador');
const [mate, lengua] = await Promise.all([
  mk('Prof. María Elena Torres', 'maria.torres@colegio.edu', 'docente'),
  mk('Prof. Jorge Ramírez', 'jorge.ramirez@colegio.edu', 'docente'),
]);
const students = await Promise.all([
  mk('Valentina Torres', 'valentina@colegio.edu', 'estudiante', { course: '1ro A' }),
  mk('Rodrigo Torres', 'rodrigo@colegio.edu', 'estudiante', { course: '1ro A' }),
  mk('Isabella Morales', 'isabella@colegio.edu', 'estudiante', { course: '1ro A' }),
  mk('Mateo Jiménez', 'mateo@colegio.edu', 'estudiante', { course: '1ro A' }),
  mk('Camila Herrera', 'camila@colegio.edu', 'estudiante', { course: '1ro A' }),
]);
const [val, rod, isa, mat, cam] = students;
await mk('Carmen Torres Vidal', 'carmen@colegio.edu', 'apoderado', { children: [val._id, rod._id] });
await mk('Pedro Vega', 'pedro@colegio.edu', 'apoderado', { children: [isa._id] });

const ids = students.map((s) => s._id);
const [matematicas, lenguaje, ciencias] = await Subject.create([
  { name: 'Matemáticas', course: '1ro A', schedule: 'Lun-Mié-Vie 08:00', teacher: mate._id, students: ids },
  { name: 'Lengua Española', course: '1ro A', schedule: 'Mar-Jue 09:00', teacher: lengua._id, students: ids },
  { name: 'Ciencias Naturales', course: '1ro A', schedule: 'Mar-Jue 11:00', teacher: mate._id, students: ids },
]);

const scores = { T1: [82, 75, 90, 68, 88], T2: [88, 80, 85, 72, 91] };
const grades = [];
for (const [subj, delta] of [[matematicas, 0], [lenguaje, -4], [ciencias, 3]]) {
  for (const p of ['T1', 'T2']) {
    students.forEach((s, i) => grades.push({ student: s._id, subject: subj._id, period: p, score: Math.max(0, Math.min(100, scores[p][i] + delta)), teacher: subj.teacher }));
  }
}
await Grade.insertMany(grades);

// Asistencia de los últimos 5 días hábiles en Matemáticas; Valentina falta el día 3
const days = [];
for (let d = new Date(); days.length < 5; d.setDate(d.getDate() - 1)) {
  if (d.getDay() % 6 !== 0) days.push(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}
const att = [];
days.forEach((date, di) => students.forEach((s, si) => {
  att.push({ student: s._id, subject: matematicas._id, date, recordedBy: mate._id, status: di === 2 && si === 0 ? 'ausente' : di === 4 && si === 3 ? 'tardanza' : 'presente' });
}));
await Attendance.insertMany(att);

const inDays = (n) => new Date(Date.now() + n * 86400000);
const [t1] = await Task.create([
  { subject: matematicas._id, title: 'Guía de ejercicios de álgebra', description: 'Resolver los ejercicios 1 al 10 y subir el PDF.', dueDate: inDays(5), createdBy: mate._id },
  { subject: lenguaje._id, title: 'Resumen de lectura', description: 'Resumen de una página del capítulo 3.', dueDate: inDays(8), createdBy: lengua._id },
  { subject: ciencias._id, title: 'Informe de laboratorio', description: 'Informe del experimento de densidad.', dueDate: inDays(12), createdBy: mate._id },
]);
await Submission.create({ task: t1._id, student: isa._id, comment: 'Entrega de prueba' });

await Notification.create({ user: val._id, title: 'Bienvenida', message: 'Ya puede consultar sus calificaciones y tareas.', type: 'sistema' });

console.log('\n✔ Datos de demostración creados. Contraseña de todos los usuarios:', PASSWORD);
console.table([
  { rol: 'administrador', correo: admin.email }, { rol: 'docente', correo: mate.email }, { rol: 'docente', correo: lengua.email },
  { rol: 'estudiante', correo: val.email }, { rol: 'apoderado', correo: 'carmen@colegio.edu' }, { rol: 'apoderado', correo: 'pedro@colegio.edu' },
]);
await mongoose.disconnect();
