process.env.NODE_ENV = 'test';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { openapi } from '../src/docs/openapi.js';
import { User } from '../src/models/User.js';
import { Grade } from '../src/models/Grade.js';
import { Subject } from '../src/models/Subject.js';
import { Justification } from '../src/models/Justification.js';
import { signToken } from '../src/utils/token.js';
import { authorize } from '../src/middlewares/auth.js';

const app = createApp();

test('GET /api/health responde ok', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('rutas protegidas devuelven 401 sin token', async () => {
  for (const url of ['/api/auth/me', '/api/users', '/api/grades', '/api/dashboard']) {
    const res = await request(app).get(url);
    assert.equal(res.status, 401, url);
  }
});

test('token inválido y token manipulado devuelven 401', async () => {
  const bad = await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi');
  assert.equal(bad.status, 401);
  const forged = jwt.sign({ sub: 'x', role: 'administrador' }, 'otra_clave');
  const res = await request(app).get('/api/users').set('Authorization', `Bearer ${forged}`);
  assert.equal(res.status, 401);
});

test('token expirado devuelve 401', async () => {
  const expired = jwt.sign({ sub: 'x' }, process.env.JWT_SECRET, { expiresIn: -10 });
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
  assert.equal(res.status, 401);
});

test('registro público rechaza roles privilegiados y contraseñas cortas (sin tocar la BD)', async () => {
  const r1 = await request(app).post('/api/auth/register').send({ name: 'Hack', email: 'h@x.com', password: 'Clave12345', role: 'administrador' });
  assert.equal(r1.status, 403);
  const r2 = await request(app).post('/api/auth/register').send({ name: 'Ana', email: 'a@x.com', password: '123' });
  assert.equal(r2.status, 400);
  const r3 = await request(app).post('/api/auth/login').send({});
  assert.equal(r3.status, 400);
  const r4 = await request(app).post('/api/auth/otp/request').send({ email: 'no-es-correo' });
  assert.equal(r4.status, 400);
});

test('middleware RBAC: authorize() bloquea roles no permitidos', () => {
  let result;
  authorize('administrador')({ user: { role: 'docente' } }, {}, (e) => (result = e));
  assert.equal(result.status, 403);
  authorize('administrador', 'docente')({ user: { role: 'docente' } }, {}, (e) => (result = e));
  assert.equal(result, undefined);
});

test('Swagger: documento OpenAPI 3.0 y UI accesibles', async () => {
  const json = await request(app).get('/api-docs.json');
  assert.equal(json.status, 200);
  assert.match(json.body.openapi, /^3\.0/);
  assert.ok(Object.keys(openapi.paths).length >= 30);
  const ui = await request(app).get('/api-docs/');
  assert.equal(ui.status, 200);
  assert.match(ui.text, /swagger/i);
});

test('ruta inexistente devuelve 404 JSON', async () => {
  const res = await request(app).get('/no-existe');
  assert.equal(res.status, 404);
  assert.ok(res.body.message);
});

test('Modelo Grade valida el rango 0-100 y el periodo', () => {
  const ok = new Grade({ student: new User()._id, subject: new Subject()._id, period: 'T1', score: 85 });
  assert.equal(ok.validateSync(), undefined);
  const bad = new Grade({ student: new User()._id, subject: new Subject()._id, period: 'T9', score: 101 });
  const e = bad.validateSync();
  assert.ok(e.errors.score && e.errors.period);
});

test('Modelo User valida correo, rol y longitud de contraseña', () => {
  const u = new User({ name: 'Ana Pérez', email: 'no-correo', password: '123', role: 'rey' });
  const e = u.validateSync();
  assert.ok(e.errors.email && e.errors.role);
});

test('Modelo Justification restringe el motivo', () => {
  const j = new Justification({ attendance: new User()._id, student: new User()._id, guardian: new User()._id, reason: 'Flojera' });
  assert.ok(j.validateSync().errors.reason);
});

test('User: contraseña corta es inválida y comparePassword usa bcrypt', async () => {
  const short = new User({ name: 'Ana Pérez', email: 'ana@x.com', password: '123' });
  assert.ok(short.validateSync().errors.password);
  const hash = await bcrypt.hash('Clave12345', env.saltRounds);
  const u = new User({ name: 'Ana Pérez', email: 'ana@x.com', password: hash });
  assert.equal(u.validateSync(), undefined);
  assert.ok(await u.comparePassword('Clave12345'));
  assert.ok(!(await u.comparePassword('otra')));
  assert.ok(env.saltRounds >= 10);
  assert.equal(u.toJSON().password, undefined); // nunca se expone el hash
});

test('signToken incluye sub, role y expiración', () => {
  const t = signToken({ _id: 'abc', role: 'docente' });
  const p = jwt.verify(t, process.env.JWT_SECRET);
  assert.equal(p.sub, 'abc');
  assert.equal(p.role, 'docente');
  assert.ok(p.exp > p.iat);
});
