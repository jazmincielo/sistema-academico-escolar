// Especificación OpenAPI 3.0 de la API del Sistema Académico Escolar.
// Se sirve con Swagger UI en /api-docs y como JSON en /api-docs.json.

const ref = (n) => ({ $ref: `#/components/schemas/${n}` });
const json = (schema) => ({ 'application/json': { schema } });
const idParam = (name = 'id', description = 'Identificador (ObjectId de MongoDB)') => ({ name, in: 'path', required: true, description, schema: { type: 'string', example: '66f1a2b3c4d5e6f7a8b9c0d1' } });
const q = (name, description, schema = { type: 'string' }) => ({ name, in: 'query', required: false, description, schema });
const err = (description) => ({ description, content: json(ref('Error')) });

/** Construye una operación. roles = [] → pública; ['*'] → cualquier usuario autenticado. */
function op({ tag, summary, rf, roles = ['*'], params = [], body, multipart, ok = 200, okDesc = 'OK', okSchema, extra = {}, binary }) {
  const secured = roles.length > 0;
  const rolesText = !secured ? 'Pública' : roles[0] === '*' ? 'Cualquier usuario autenticado' : roles.join(', ');
  const responses = {
    [ok]: ok === 204 ? { description: okDesc } : { description: okDesc, ...(binary ? { content: { [binary]: { schema: { type: 'string', format: 'binary' } } } } : { content: json(okSchema || { type: 'object' }) }) },
    ...(body || multipart ? { 400: err('Datos inválidos') } : {}),
    ...(secured ? { 401: err('Token ausente, inválido o expirado'), ...(roles[0] !== '*' ? { 403: err('Rol sin permiso') } : {}) } : {}),
    ...(params.some((p) => p.in === 'path') ? { 404: err('Recurso no encontrado') } : {}),
    ...extra,
  };
  return {
    tags: [tag], summary, description: `${rf ? `**${rf}** · ` : ''}Roles permitidos: **${rolesText}**.`,
    'x-roles': roles, ...(secured ? { security: [{ bearerAuth: [] }] } : {}),
    ...(params.length ? { parameters: params } : {}),
    ...(body ? { requestBody: { required: true, content: json(body) } } : {}),
    ...(multipart ? { requestBody: { required: true, content: { 'multipart/form-data': { schema: multipart } } } } : {}),
    responses,
  };
}

const obj = (properties, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const str = (example, extra = {}) => ({ type: 'string', example, ...extra });
const oid = { type: 'string', example: '66f1a2b3c4d5e6f7a8b9c0d1' };
const ROLE = { type: 'string', enum: ['administrador', 'docente', 'estudiante', 'apoderado'] };
const PERIOD = { type: 'string', enum: ['T1', 'T2', 'T3'] };

const schemas = {
  Error: obj({ message: str('Datos inválidos'), details: { type: 'array', items: { type: 'object' } } }),
  User: obj({ _id: oid, name: str('María Elena Torres'), email: str('maria.torres@colegio.edu'), role: ROLE, active: { type: 'boolean' }, course: str('1ro A'), children: { type: 'array', items: oid }, createdAt: { type: 'string', format: 'date-time' } }),
  AuthResponse: obj({ token: str('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'), expiresIn: str('1h'), user: ref('User') }),
  Subject: obj({ _id: oid, name: str('Matemáticas'), course: str('1ro A'), year: { type: 'integer', example: 2026 }, schedule: str('Lun-Mié-Vie 08:00'), teacher: oid, students: { type: 'array', items: oid } }),
  GradeInput: obj({ student: oid, score: { type: 'number', minimum: 0, maximum: 100, example: 85 }, comment: str('Buen desempeño') }, ['student', 'score']),
};

const auth = 'Autenticación', usr = 'Usuarios', sub = 'Materias', gr = 'Calificaciones', at = 'Asistencia', tk = 'Tareas', ju = 'Justificaciones', no = 'Notificaciones', da = 'Panel principal', re = 'Reportes';
const A = 'administrador', D = 'docente', E = 'estudiante', P = 'apoderado';
const created = { ok: 201, okDesc: 'Creado' };

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Sistema Académico Escolar — API REST',
    version: '1.0.0',
    description: 'API del Sistema Académico Escolar (Tecnologías en Internet, UAB).\n\n**Autenticación:** obtenga un token con `POST /api/auth/login` (o el flujo OTP) y pulse **Authorize** pegando solo el token. Todas las rutas protegidas exigen `Authorization: Bearer <token>`.\n\n**Escala de notas:** 0–100.',
  },
  servers: [{ url: '/', description: 'Servidor actual' }],
  tags: [auth, da, usr, sub, gr, re, at, tk, ju, no].map((name) => ({ name })),
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas },
  paths: {
    '/api/health': { get: op({ tag: auth, summary: 'Estado del servicio', roles: [] }) },
    '/api/auth/register': { post: op({ tag: auth, summary: 'Registro público (estudiante o apoderado)', rf: 'RF-001', roles: [], ok: 201, okDesc: 'Usuario creado + token', okSchema: ref('AuthResponse'), body: obj({ name: str('Ana Pérez'), email: str('ana@colegio.edu'), password: str('Clave12345'), role: { type: 'string', enum: ['estudiante', 'apoderado'] } }, ['name', 'email', 'password']), extra: { 409: err('Correo ya registrado') } }) },
    '/api/auth/login': { post: op({ tag: auth, summary: 'Inicio de sesión con correo y contraseña', rf: 'RF-001', roles: [], okSchema: ref('AuthResponse'), body: obj({ email: str('maria.torres@colegio.edu'), password: str('Demo12345') }, ['email', 'password']), extra: { 401: err('Credenciales inválidas') } }) },
    '/api/auth/otp/request': { post: op({ tag: auth, summary: 'Solicitar código OTP por correo (UC-01)', rf: 'RF-001', roles: [], body: obj({ email: str('maria.torres@colegio.edu') }, ['email']), extra: { 404: err('Usuario no encontrado en la base de datos') } }) },
    '/api/auth/otp/verify': { post: op({ tag: auth, summary: 'Verificar OTP y obtener JWT (UC-01)', rf: 'RF-001', roles: [], okSchema: ref('AuthResponse'), body: obj({ email: str('maria.torres@colegio.edu'), code: str('123456') }, ['email', 'code']) }) },
    '/api/auth/me': { get: op({ tag: auth, summary: 'Perfil del usuario con sesión activa', rf: 'RF-002', okSchema: obj({ user: ref('User') }) }) },

    '/api/dashboard': { get: op({ tag: da, summary: 'Métricas del panel según el rol', rf: 'RF-003' }) },

    '/api/users': {
      get: op({ tag: usr, summary: 'Listar usuarios (paginado, filtros)', rf: 'RF-002', roles: [A], params: [q('role', 'Filtrar por rol', ROLE), q('q', 'Buscar por nombre o correo'), q('active', 'true/false', { type: 'boolean' }), q('page', 'Página', { type: 'integer' }), q('limit', 'Tamaño de página (máx. 100)', { type: 'integer' })] }),
      post: op({ tag: usr, summary: 'Crear usuario con cualquier rol', rf: 'RF-002', roles: [A], ...created, body: obj({ name: str('Prof. Jorge Ramírez'), email: str('jorge@colegio.edu'), password: str('Clave12345'), role: ROLE, course: str('2do B'), children: { type: 'array', items: oid } }, ['name', 'email', 'password', 'role']), extra: { 409: err('Correo duplicado') } }),
    },
    '/api/users/stats': { get: op({ tag: usr, summary: 'Conteo de usuarios por rol', roles: [A] }) },
    '/api/users/{id}': {
      get: op({ tag: usr, summary: 'Obtener un usuario', roles: [A], params: [idParam()] }),
      put: op({ tag: usr, summary: 'Actualizar usuario (rol, estado, hijos, contraseña)', rf: 'RF-002', roles: [A], params: [idParam()], body: obj({ name: str('Nombre'), email: str('x@colegio.edu'), password: str('NuevaClave123'), role: ROLE, active: { type: 'boolean' }, course: str('1ro A'), children: { type: 'array', items: oid } }) }),
      delete: op({ tag: usr, summary: 'Desactivar usuario (baja lógica)', roles: [A], params: [idParam()] }),
    },

    '/api/subjects': {
      get: op({ tag: sub, summary: 'Listar materias visibles para el usuario', params: [q('course', 'Filtrar por curso')] }),
      post: op({ tag: sub, summary: 'Crear materia (docente + estudiantes matriculados)', roles: [A], ...created, body: obj({ name: str('Matemáticas'), course: str('1ro A'), schedule: str('Lun-Mié-Vie 08:00'), teacher: oid, students: { type: 'array', items: oid } }, ['name', 'course', 'teacher']), extra: { 409: err('Materia duplicada para el curso y año') } }),
    },
    '/api/subjects/{id}': {
      get: op({ tag: sub, summary: 'Detalle de materia', params: [idParam()] }),
      put: op({ tag: sub, summary: 'Actualizar materia / matrícula', roles: [A], params: [idParam()], body: ref('Subject') }),
      delete: op({ tag: sub, summary: 'Eliminar materia', roles: [A], params: [idParam()], ok: 204, okDesc: 'Eliminada' }),
    },

    '/api/grades': { get: op({ tag: gr, summary: 'Listar calificaciones (acotado por rol)', rf: 'RF-004', params: [q('subject', 'id de materia'), q('period', 'T1, T2 o T3', PERIOD), q('student', 'id de estudiante')] }) },
    '/api/grades/sheet': { get: op({ tag: gr, summary: 'Planilla de notas de una materia y periodo', rf: 'RF-004', roles: [D, A], params: [{ ...q('subject', 'id de materia'), required: true }, { ...q('period', 'Periodo', PERIOD), required: true }] }) },
    '/api/grades/bulk': { put: op({ tag: gr, summary: 'Guardar y publicar calificaciones (UC-03)', rf: 'RF-004', roles: [D, A], body: obj({ subject: oid, period: PERIOD, grades: { type: 'array', items: ref('GradeInput') } }, ['subject', 'period', 'grades']), extra: { 400: err('Nota fuera de rango (0-100) o estudiante no matriculado') } }) },
    '/api/grades/bulletin/{studentId}': { get: op({ tag: gr, summary: 'Boletín en JSON de un estudiante', rf: 'RF-009', params: [idParam('studentId', 'id del estudiante')] }) },
    '/api/grades/{id}': { delete: op({ tag: gr, summary: 'Eliminar una calificación', roles: [D, A], params: [idParam()], ok: 204, okDesc: 'Eliminada' }) },
    '/api/reports/bulletin/{studentId}': { get: op({ tag: re, summary: 'Boletín oficial en PDF', rf: 'RF-009', params: [idParam('studentId', 'id del estudiante')], binary: 'application/pdf', okDesc: 'Archivo PDF' }) },

    '/api/attendance': { get: op({ tag: at, summary: 'Listar asistencia (acotada por rol)', rf: 'RF-005', params: [q('student', 'id de estudiante'), q('subject', 'id de materia'), q('from', 'YYYY-MM-DD'), q('to', 'YYYY-MM-DD')] }) },
    '/api/attendance/sheet': { get: op({ tag: at, summary: 'Lista del día para una materia', rf: 'RF-005', roles: [D, A], params: [{ ...q('subject', 'id de materia'), required: true }, { ...q('date', 'YYYY-MM-DD'), required: true }] }) },
    '/api/attendance/bulk': { post: op({ tag: at, summary: 'Registrar asistencia diaria de una materia', rf: 'RF-005', roles: [D, A], body: obj({ subject: oid, date: str('2026-09-20'), records: { type: 'array', items: obj({ student: oid, status: { type: 'string', enum: ['presente', 'ausente', 'tardanza'] } }) } }, ['subject', 'date', 'records']) }) },
    '/api/attendance/summary/{studentId}': { get: op({ tag: at, summary: 'Porcentaje y conteo de asistencia', params: [idParam('studentId', 'id del estudiante')] }) },

    '/api/tasks': {
      get: op({ tag: tk, summary: 'Listar tareas (con estado de entrega para estudiante/apoderado)', rf: 'RF-007', params: [q('subject', 'id de materia'), q('student', 'id del hijo (apoderado)'), q('pending', 'true = solo pendientes', { type: 'boolean' })] }),
      post: op({ tag: tk, summary: 'Crear y asignar una tarea', rf: 'RF-007', roles: [D, A], ...created, body: obj({ subject: oid, title: str('Ejercicios de álgebra'), description: str('Resolver la guía 3'), dueDate: str('2026-10-05T23:59:00Z') }, ['subject', 'title', 'dueDate']) }),
    },
    '/api/tasks/{id}': {
      put: op({ tag: tk, summary: 'Editar tarea', rf: 'RF-007', roles: [D, A], params: [idParam()], body: obj({ title: str('Nuevo título'), description: str('...'), dueDate: str('2026-10-10T23:59:00Z') }) }),
      delete: op({ tag: tk, summary: 'Eliminar tarea y sus entregas', roles: [D, A], params: [idParam()], ok: 204, okDesc: 'Eliminada' }),
    },
    '/api/tasks/{id}/submissions': {
      get: op({ tag: tk, summary: 'Ver entregas de una tarea', rf: 'RF-008', roles: [D, A], params: [idParam()] }),
      post: op({ tag: tk, summary: 'Entregar una tarea con archivo adjunto (máx. 5MB)', rf: 'RF-008', roles: [E], params: [idParam()], ...created, multipart: obj({ file: { type: 'string', format: 'binary' }, comment: { type: 'string' } }) }),
    },
    '/api/tasks/submissions/{submissionId}/file': { get: op({ tag: tk, summary: 'Descargar archivo de una entrega', roles: [D, A, E], params: [idParam('submissionId')], binary: 'application/octet-stream', okDesc: 'Archivo' }) },

    '/api/justifications': {
      get: op({ tag: ju, summary: 'Listar solicitudes de justificación', rf: 'RF-010', roles: [P, A], params: [q('status', 'Pendiente, Aprobada o Rechazada')] }),
      post: op({ tag: ju, summary: 'Solicitar justificación de inasistencia (UC-08)', rf: 'RF-010', roles: [P], ...created, multipart: obj({ attendance: { type: 'string', description: 'id de la inasistencia' }, reason: { type: 'string', enum: ['Salud', 'Familiar', 'Fuerza Mayor'] }, detail: { type: 'string' }, file: { type: 'string', format: 'binary', description: 'PDF o JPG, máx. 5MB' } }), extra: { 409: err('La falta ya tiene una solicitud vigente o no es una inasistencia') } }),
    },
    '/api/justifications/{id}/review': { patch: op({ tag: ju, summary: 'Aprobar o rechazar una solicitud (Regencia)', rf: 'RF-006', roles: [A], params: [idParam()], body: obj({ status: { type: 'string', enum: ['Aprobada', 'Rechazada'] }, note: str('Comprobante válido') }, ['status']), extra: { 409: err('La solicitud ya fue resuelta') } }) },
    '/api/justifications/{id}/file': { get: op({ tag: ju, summary: 'Descargar comprobante adjunto', roles: [P, A], params: [idParam()], binary: 'application/octet-stream', okDesc: 'Archivo' }) },

    '/api/notifications': { get: op({ tag: no, summary: 'Mis notificaciones y total sin leer', rf: 'RF-006' }) },
    '/api/notifications/read-all': { patch: op({ tag: no, summary: 'Marcar todas como leídas' }) },
    '/api/notifications/{id}/read': { patch: op({ tag: no, summary: 'Marcar una notificación como leída', params: [idParam()] }) },
  },
};
