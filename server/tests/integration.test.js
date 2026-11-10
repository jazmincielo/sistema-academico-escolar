// Pruebas de integración end-to-end contra MongoDB real.
// Requiere un MongoDB accesible (por defecto mongodb://127.0.0.1:27017). Si no hay conexión, se omiten.
//   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/sae_integration npm run test:integration
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/sae_integration';
process.env.EXPOSE_DEV_OTP = 'true';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';

const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');
const { Attendance } = await import('../src/models/Attendance.js');
const { Notification } = await import('../src/models/Notification.js');

let up = false;
const app = createApp();
const ctx = {};
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const login = async (email, password = 'Clave12345') => (await request(app).post('/api/auth/login').send({ email, password })).body;

before(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2500 });
    await mongoose.connection.dropDatabase();
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
    up = true;
  } catch { console.log('MongoDB no disponible: se omiten las pruebas de integración'); }
});
after(async () => { if (up) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
const t = (name, fn) => test(name, async (c) => { if (!up) return c.skip('sin MongoDB'); await fn(c); });

t('seed de usuarios base y login con contraseña (bcrypt + JWT)', async () => {
  for (const [name, email, role, extra] of [
    ['Admin Colegio', 'admin@t.edu', 'administrador'], ['Prof Torres', 'doc@t.edu', 'docente'], ['Prof Otro', 'doc2@t.edu', 'docente'],
    ['Ana Alumna', 'ana@t.edu', 'estudiante', { course: '1ro A' }], ['Beto Alumno', 'beto@t.edu', 'estudiante', { course: '1ro A' }],
  ]) await User.create({ name, email, password: 'Clave12345', role, ...extra });
  const raw = await User.findOne({ email: 'admin@t.edu' }).select('+password');
  assert.notEqual(raw.password, 'Clave12345');
  assert.ok(raw.password.startsWith('$2'));

  ctx.admin = (await login('admin@t.edu')).token;
  ctx.doc = (await login('doc@t.edu')).token;
  ctx.doc2 = (await login('doc2@t.edu')).token;
  const ana = await login('ana@t.edu');
  ctx.ana = ana.token; ctx.anaId = ana.user._id;
  const beto = await login('beto@t.edu');
  ctx.beto = beto.token; ctx.betoId = beto.user._id;
  assert.ok(ctx.admin && ctx.doc && ctx.ana);
  const bad = await request(app).post('/api/auth/login').send({ email: 'admin@t.edu', password: 'mala' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.token, undefined);
});

t('registro público (apoderado) + GET /auth/me + correo duplicado 409', async () => {
  const r = await request(app).post('/api/auth/register').send({ name: 'Papá de Ana', email: 'papa@t.edu', password: 'Clave12345', role: 'apoderado' });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.password, undefined);
  ctx.papa = r.body.token; ctx.papaId = r.body.user._id;
  const me = await request(app).get('/api/auth/me').set(bearer(ctx.papa));
  assert.equal(me.body.user.email, 'papa@t.edu');
  const dup = await request(app).post('/api/auth/register').send({ name: 'Otro', email: 'papa@t.edu', password: 'Clave12345' });
  assert.equal(dup.status, 409);
});

t('flujo OTP: solicitar, código erróneo, código correcto, un solo uso', async () => {
  const unknown = await request(app).post('/api/auth/otp/request').send({ email: 'nadie@t.edu' });
  assert.equal(unknown.status, 404);
  assert.match(unknown.body.message, /Usuario no encontrado/);
  const req = await request(app).post('/api/auth/otp/request').send({ email: 'doc@t.edu' });
  assert.equal(req.status, 200);
  assert.match(req.body.devCode, /^\d{6}$/);
  const wrong = await request(app).post('/api/auth/otp/verify').send({ email: 'doc@t.edu', code: '000000' });
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.message, /inválido o expirado/);
  const ok = await request(app).post('/api/auth/otp/verify').send({ email: 'doc@t.edu', code: req.body.devCode });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  const again = await request(app).post('/api/auth/otp/verify').send({ email: 'doc@t.edu', code: req.body.devCode });
  assert.equal(again.status, 400);
});

t('RBAC: cada rol solo accede a lo suyo', async () => {
  assert.equal((await request(app).get('/api/users').set(bearer(ctx.doc))).status, 403);
  assert.equal((await request(app).get('/api/users').set(bearer(ctx.ana))).status, 403);
  assert.equal((await request(app).get('/api/users').set(bearer(ctx.admin))).status, 200);
  assert.equal((await request(app).post('/api/subjects').set(bearer(ctx.doc)).send({})).status, 403);
  assert.equal((await request(app).put('/api/grades/bulk').set(bearer(ctx.ana)).send({})).status, 403);
  assert.equal((await request(app).get('/api/justifications').set(bearer(ctx.ana))).status, 403);
});

t('admin: CRUD de usuarios y materias, vincula apoderado e hijos', async () => {
  const link = await request(app).put(`/api/users/${ctx.papaId}`).set(bearer(ctx.admin)).send({ children: [ctx.anaId] });
  assert.equal(link.status, 200);
  const notStudent = await request(app).put(`/api/users/${ctx.papaId}`).set(bearer(ctx.admin)).send({ children: [ctx.papaId] });
  assert.equal(notStudent.status, 400);
  ctx.papa = (await login('papa@t.edu')).token;

  const doc = await User.findOne({ email: 'doc@t.edu' });
  const sub = await request(app).post('/api/subjects').set(bearer(ctx.admin)).send({ name: 'Matemáticas', course: '1ro A', teacher: String(doc._id), students: [ctx.anaId, ctx.betoId] });
  assert.equal(sub.status, 201);
  ctx.subject = sub.body.subject._id;
  const dup = await request(app).post('/api/subjects').set(bearer(ctx.admin)).send({ name: 'Matemáticas', course: '1ro A', teacher: String(doc._id) });
  assert.equal(dup.status, 409);

  const mine = await request(app).get('/api/subjects').set(bearer(ctx.doc));
  assert.equal(mine.body.items.length, 1);
  assert.equal((await request(app).get('/api/subjects').set(bearer(ctx.doc2))).body.items.length, 0);

  const created = await request(app).post('/api/users').set(bearer(ctx.admin)).send({ name: 'Temporal Uno', email: 'tmp@t.edu', password: 'Clave12345', role: 'docente' });
  assert.equal(created.status, 201);
  const off = await request(app).delete(`/api/users/${created.body.user._id}`).set(bearer(ctx.admin));
  assert.equal(off.status, 200);
  assert.equal((await request(app).post('/api/auth/login').send({ email: 'tmp@t.edu', password: 'Clave12345' })).status, 401);
  const self = await request(app).delete(`/api/users/${(await User.findOne({ email: 'admin@t.edu' }))._id}`).set(bearer(ctx.admin));
  assert.equal(self.status, 400);
});

t('calificaciones: rango 0-100, titularidad, boletín, PDF y notificaciones', async () => {
  const body = (score) => ({ subject: ctx.subject, period: 'T1', grades: [{ student: ctx.anaId, score }, { student: ctx.betoId, score: 70 }] });
  const over = await request(app).put('/api/grades/bulk').set(bearer(ctx.doc)).send(body(101));
  assert.equal(over.status, 400);
  assert.match(over.body.details[0].message, /fuera de rango/);
  assert.equal((await request(app).put('/api/grades/bulk').set(bearer(ctx.doc)).send(body(-1))).status, 400);
  assert.equal((await request(app).put('/api/grades/bulk').set(bearer(ctx.doc2)).send(body(80))).status, 403); // docente no titular

  assert.equal((await request(app).put('/api/grades/bulk').set(bearer(ctx.doc)).send(body(88))).status, 200);
  assert.equal((await request(app).put('/api/grades/bulk').set(bearer(ctx.doc)).send(body(92))).status, 200); // upsert, no duplica
  const sheet = await request(app).get('/api/grades/sheet').query({ subject: ctx.subject, period: 'T1' }).set(bearer(ctx.doc));
  assert.equal(sheet.body.rows.find((r) => r.student._id === ctx.anaId).score, 92);

  const bulletin = await request(app).get(`/api/grades/bulletin/${ctx.anaId}`).set(bearer(ctx.ana));
  assert.equal(bulletin.status, 200);
  assert.equal(bulletin.body.rows[0].T1, 92);
  assert.equal(bulletin.body.generalAverage, 92);
  // Estudiante no ve a otro; el apoderado ve a su hijo pero no a otros
  assert.equal((await request(app).get(`/api/grades/bulletin/${ctx.betoId}`).set(bearer(ctx.ana))).status, 403);
  assert.equal((await request(app).get(`/api/grades/bulletin/${ctx.anaId}`).set(bearer(ctx.papa))).status, 200);
  assert.equal((await request(app).get(`/api/grades/bulletin/${ctx.betoId}`).set(bearer(ctx.papa))).status, 403);

  const pdf = await request(app).get(`/api/reports/bulletin/${ctx.anaId}`).set(bearer(ctx.papa)).buffer(true).parse((res, cb) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers['content-type'], /pdf/);
  assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');

  await new Promise((r) => setTimeout(r, 300)); // las notificaciones se crean de forma asíncrona
  assert.ok(await Notification.countDocuments({ user: ctx.anaId, type: 'calificacion' }) >= 1);
  assert.ok(await Notification.countDocuments({ user: ctx.papaId, type: 'calificacion' }) >= 1);
});

t('asistencia → justificación (UC-08) → aprobación → estado justificada', async () => {
  const save = await request(app).post('/api/attendance/bulk').set(bearer(ctx.doc)).send({
    subject: ctx.subject, date: '2026-09-20', records: [{ student: ctx.anaId, status: 'ausente' }, { student: ctx.betoId, status: 'presente' }],
  });
  assert.equal(save.status, 200);
  assert.equal((await request(app).post('/api/attendance/bulk').set(bearer(ctx.doc)).send({ subject: ctx.subject, date: '20/09/2026', records: [] })).status, 400);

  const list = await request(app).get('/api/attendance').query({ student: ctx.anaId }).set(bearer(ctx.papa));
  const absence = list.body.items.find((a) => a.status === 'ausente');
  assert.ok(absence);
  const sum = await request(app).get(`/api/attendance/summary/${ctx.anaId}`).set(bearer(ctx.ana));
  assert.equal(sum.body.percentage, 0);

  const pdfBuf = Buffer.from('%PDF-1.4 comprobante');
  const noFile = await request(app).post('/api/justifications').set(bearer(ctx.papa)).field('attendance', absence._id).field('reason', 'Salud');
  assert.equal(noFile.status, 400);
  const wrongType = await request(app).post('/api/justifications').set(bearer(ctx.papa)).field('attendance', absence._id).field('reason', 'Salud').attach('file', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/x-msdownload' });
  assert.equal(wrongType.status, 400);
  assert.match(wrongType.body.message, /Formato o tamaño/);
  const tooBig = await request(app).post('/api/justifications').set(bearer(ctx.papa)).field('attendance', absence._id).field('reason', 'Salud').attach('file', Buffer.alloc(5 * 1024 * 1024 + 10), { filename: 'big.pdf', contentType: 'application/pdf' });
  assert.equal(tooBig.status, 400);

  const okRes = await request(app).post('/api/justifications').set(bearer(ctx.papa)).field('attendance', absence._id).field('reason', 'Salud').field('detail', 'Gripe').attach('file', pdfBuf, { filename: 'cert.pdf', contentType: 'application/pdf' });
  assert.equal(okRes.status, 201);
  assert.equal(okRes.body.justification.status, 'Pendiente');
  assert.match(okRes.body.justification.ticket, /^JUS-/);
  ctx.just = okRes.body.justification._id;

  const dup = await request(app).post('/api/justifications').set(bearer(ctx.papa)).field('attendance', absence._id).field('reason', 'Familiar').attach('file', pdfBuf, { filename: 'c.pdf', contentType: 'application/pdf' });
  assert.equal(dup.status, 409); // flujo alternativo A2

  // El apoderado de otro estudiante no puede justificar esta falta
  const otro = await request(app).post('/api/auth/register').send({ name: 'Apoderado Ajeno', email: 'ajeno@t.edu', password: 'Clave12345', role: 'apoderado' });
  const ajeno = await request(app).post('/api/justifications').set(bearer(otro.body.token)).field('attendance', absence._id).field('reason', 'Salud').attach('file', pdfBuf, { filename: 'c.pdf', contentType: 'application/pdf' });
  assert.equal(ajeno.status, 403);

  assert.equal((await request(app).patch(`/api/justifications/${ctx.just}/review`).set(bearer(ctx.papa)).send({ status: 'Aprobada' })).status, 403);
  assert.equal((await request(app).patch(`/api/justifications/${ctx.just}/review`).set(bearer(ctx.admin)).send({ status: 'Quizás' })).status, 400);
  const rev = await request(app).patch(`/api/justifications/${ctx.just}/review`).set(bearer(ctx.admin)).send({ status: 'Aprobada', note: 'OK' });
  assert.equal(rev.status, 200);
  assert.equal((await Attendance.findById(absence._id)).status, 'justificada');
  assert.equal((await request(app).patch(`/api/justifications/${ctx.just}/review`).set(bearer(ctx.admin)).send({ status: 'Rechazada' })).status, 409);

  const dl = await request(app).get(`/api/justifications/${ctx.just}/file`).set(bearer(ctx.papa));
  assert.equal(dl.status, 200);
});

t('tareas: docente crea, estudiante entrega con archivo, docente ve entregas', async () => {
  const due = new Date(Date.now() + 5 * 86400000).toISOString();
  const create = await request(app).post('/api/tasks').set(bearer(ctx.doc)).send({ subject: ctx.subject, title: 'Guía 1', description: 'Resolver', dueDate: due });
  assert.equal(create.status, 201);
  assert.equal((await request(app).post('/api/tasks').set(bearer(ctx.doc2)).send({ subject: ctx.subject, title: 'Intruso', dueDate: due })).status, 403);
  assert.equal((await request(app).post('/api/tasks').set(bearer(ctx.ana)).send({ subject: ctx.subject, title: 'x', dueDate: due })).status, 403);
  const id = create.body.task._id;

  const pending = await request(app).get('/api/tasks').set(bearer(ctx.ana));
  assert.equal(pending.body.items[0].submission, null);
  const sub = await request(app).post(`/api/tasks/${id}/submissions`).set(bearer(ctx.ana)).field('comment', 'Listo').attach('file', Buffer.from('%PDF-1.4 x'), { filename: 'tarea.pdf', contentType: 'application/pdf' });
  assert.equal(sub.status, 201);
  assert.equal(sub.body.submission.late, false);
  const resub = await request(app).post(`/api/tasks/${id}/submissions`).set(bearer(ctx.ana)).field('comment', 'Corregida');
  assert.equal(resub.status, 201); // reenvío: upsert, no duplica

  const list = await request(app).get(`/api/tasks/${id}/submissions`).set(bearer(ctx.doc));
  assert.equal(list.body.items.length, 1);
  assert.equal((await request(app).get(`/api/tasks/${id}/submissions`).set(bearer(ctx.ana))).status, 403);
  const file = await request(app).get(`/api/tasks/submissions/${list.body.items[0]._id}/file`).set(bearer(ctx.doc));
  assert.equal(file.status, 200);
  assert.equal((await request(app).get(`/api/tasks/submissions/${list.body.items[0]._id}/file`).set(bearer(ctx.beto))).status, 403);
  assert.equal((await request(app).get('/api/tasks').query({ student: ctx.anaId }).set(bearer(ctx.papa))).status, 200);
});

t('dashboard por rol, notificaciones y validación de ids', async () => {
  const a = await request(app).get('/api/dashboard').set(bearer(ctx.admin));
  assert.ok(a.body.users.estudiante >= 2);
  const d = await request(app).get('/api/dashboard').set(bearer(ctx.doc));
  assert.equal(d.body.subjects.length, 1);
  assert.equal(d.body.totalStudents, 2);
  const e = await request(app).get('/api/dashboard').set(bearer(ctx.ana));
  assert.equal(e.body.generalAverage, 92);
  const p = await request(app).get('/api/dashboard').set(bearer(ctx.papa));
  assert.equal(p.body.children[0].student.name, 'Ana Alumna');

  const n = await request(app).get('/api/notifications').set(bearer(ctx.papa));
  assert.ok(n.body.unread >= 1);
  assert.equal((await request(app).patch('/api/notifications/read-all').set(bearer(ctx.papa))).status, 200);
  assert.equal((await request(app).get('/api/notifications').set(bearer(ctx.papa))).body.unread, 0);

  assert.equal((await request(app).get('/api/users/no-es-un-id').set(bearer(ctx.admin))).status, 400);
  assert.equal((await request(app).get('/api/users/66f1a2b3c4d5e6f7a8b9c0d1').set(bearer(ctx.admin))).status, 404);
});
