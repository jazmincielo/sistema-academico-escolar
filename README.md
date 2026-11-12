# 🎓 Sistema Académico Escolar

Plataforma web para la gestión académica de colegios: calificaciones, asistencia, tareas, boletines en PDF, justificación de inasistencias y notificaciones, con cuatro roles (**Administrador, Docente, Estudiante y Apoderado**).

Proyecto Integrador — *Tecnologías de Internet*, Ingeniería de Sistemas, Universidad Adventista de Bolivia.
**Segunda entrega: producto implementado.** (La primera entrega — requisitos, casos de uso, UX y prototipo Figma — está en el informe de la entrega 1.)

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS 4 + React Router + Axios |
| Backend | Node.js + Express 4 (API REST) |
| Base de datos | MongoDB + Mongoose ODM |
| Seguridad | JWT (Bearer), RBAC, bcryptjs (salt ≥ 10), Helmet, CORS, rate limiting, `.env` |
| Documentación | Swagger UI / OpenAPI 3.0 en `/api-docs` |

## Estructura del repositorio

```
.
├── server/                 # API Node.js + Express
│   ├── src/
│   │   ├── config/         # variables de entorno y conexión a MongoDB
│   │   ├── models/         # esquemas Mongoose (8 colecciones, validaciones e índices)
│   │   ├── middlewares/    # authenticate (JWT), authorize (RBAC), upload, errores
│   │   ├── controllers/    # lógica de negocio
│   │   ├── routes/         # definición de endpoints y permisos por rol
│   │   ├── services/       # acceso por rol, notificaciones, correo, boletín
│   │   ├── docs/openapi.js # especificación Swagger / OpenAPI 3.0
│   │   └── seed.js         # datos de demostración
│   ├── tests/              # pruebas unitarias y de integración
│   └── .env.example
├── client/                 # SPA React (Vite + Tailwind)
│   ├── src/{api,context,components,pages}
│   └── .env.example
├── docs/                   # diagramas, capturas, openapi.json e informe técnico
├── .gitignore
└── README.md
```

## Requisitos previos

- [Node.js](https://nodejs.org) **18 o superior** (probado con 22) y npm
- [MongoDB](https://www.mongodb.com/try/download/community) local **o** un clúster gratuito de [MongoDB Atlas](https://www.mongodb.com/atlas)
- Git

## Instalación y ejecución local

```bash
# 1. Clonar
git clone https://github.com/jazmincielo/sistema-academico-escolar.git
cd sistema-academico-escolar

# 2. Backend
cd server
npm install
cp .env.example .env        # en Windows: copy .env.example .env
#   → edite .env: MONGODB_URI y JWT_SECRET (ver tabla de variables abajo)
npm run seed                # (opcional) crea usuarios y datos de demostración
npm run dev                 # API en http://localhost:5000  ·  Swagger en /api-docs

# 3. Frontend (en otra terminal)
cd client
npm install
cp .env.example .env
npm run dev                 # SPA en http://localhost:5173
```

Abra **http://localhost:5173**. En desarrollo, Vite redirige `/api` y `/api-docs` al backend, por lo que no hace falta configurar CORS.

### Usuarios de demostración (tras `npm run seed`)

Contraseña de todos: `Demo12345`

| Rol | Correo |
|---|---|
| Administrador | carlos@colegio.edu |
| Docente | maria.torres@colegio.edu |
| Estudiante | valentina@colegio.edu |
| Apoderado | carmen@colegio.edu (hijos: Valentina y Rodrigo) |

También puede ingresar con **código OTP**: con `EXPOSE_DEV_OTP=true` el código se muestra en pantalla y se imprime en la consola del servidor (no hay que configurar SMTP).

## Variables de entorno

**`server/.env`**

| Variable | Descripción | Ejemplo |
|---|---|---|
| `NODE_ENV` | `development` / `production` / `test` | `development` |
| `PORT` | Puerto de la API | `5000` |
| `CLIENT_URL` | Origen(es) permitidos por CORS (separados por coma) | `http://localhost:5173` |
| `MONGODB_URI` | Cadena de conexión de MongoDB | `mongodb://127.0.0.1:27017/sistema_academico` |
| `JWT_SECRET` | Clave de firma de los tokens (≥ 32 caracteres en producción) | *(aleatoria)* |
| `JWT_EXPIRES_IN` | Vigencia del token | `1h` |
| `BCRYPT_SALT_ROUNDS` | Costo de bcrypt (mínimo efectivo 10) | `10` |
| `OTP_TTL_MINUTES` | Vigencia del código OTP | `3` |
| `EXPOSE_DEV_OTP` | Devuelve el OTP en la respuesta (**solo desarrollo**) | `true` |
| `SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM` | Servidor de correo; vacío = los correos se imprimen en consola | |

**`client/.env`**: `VITE_API_URL` (por defecto `/api`) y `VITE_API_ORIGIN` (origen del backend para el enlace a Swagger en producción).

Generar un `JWT_SECRET` seguro: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Pruebas

```bash
cd server
npm test                    # unitarias: modelos, JWT, RBAC, Swagger (no requieren BD)
npm run test:integration    # end-to-end contra MongoDB real (usa la BD sae_integration y la borra al terminar)
```

La suite de integración recorre los flujos principales: registro/login/OTP, RBAC por rol, CRUD de usuarios y materias, carga de notas (rango 0–100), boletín PDF, asistencia → justificación → aprobación, tareas con archivos y dashboard.

## Documentación de la API

Con el servidor en marcha: **http://localhost:5000/api-docs** (Swagger UI interactivo). Pulse **Authorize** y pegue el token obtenido en `POST /api/auth/login`. El JSON OpenAPI está en `/api-docs.json` y en `docs/openapi.json`.

## Roles y permisos (RBAC)

| Módulo | Administrador | Docente | Estudiante | Apoderado |
|---|:-:|:-:|:-:|:-:|
| Usuarios y materias (CRUD) | ✅ | – | – | – |
| Cargar notas / tomar asistencia / crear tareas | ✅ | ✅ (solo sus materias) | – | – |
| Ver boletín, asistencia y tareas | ✅ | ✅ (sus materias) | ✅ (propios) | ✅ (de sus hijos) |
| Entregar tareas | – | – | ✅ | – |
| Solicitar justificación | – | – | – | ✅ |
| Aprobar / rechazar justificación | ✅ | – | – | – |

El RBAC se aplica **en el backend** (middleware `authorize` + filtros por pertenencia en cada consulta); las rutas protegidas del frontend son solo una ayuda de usabilidad.

## Despliegue (resumen)

1. Base de datos: cree un clúster en MongoDB Atlas y use su URI en `MONGODB_URI`.
2. API: defina las variables del `.env` en el proveedor (Render, Railway, etc.), `NODE_ENV=production`, `EXPOSE_DEV_OTP=false`, `CLIENT_URL` = URL del frontend. Comando de inicio: `npm start`.
3. SPA: `npm run build` en `client/` y publique `dist/` (Netlify, Vercel…) con `VITE_API_URL` apuntando a la API.

> Los archivos subidos se guardan en `server/uploads/`. En proveedores con disco efímero conviene migrar a un almacenamiento de objetos (S3 / Cloudinary).

## Integrantes

Juan Daniel Ancieta Toledo · Jazmin Cielo Canaviri Mamani · Diego Alejandro Mendez Benitez · Saul Lander Reyes Guzman
Docente: Víctor Hugo Sarzuri Flores — Universidad Adventista de Bolivia, Cochabamba.

Licencia MIT.
