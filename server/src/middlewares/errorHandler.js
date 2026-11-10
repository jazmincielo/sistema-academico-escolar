import { env } from '../config/env.js';

export const notFound = (req, res) => {
  res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Error interno del servidor';
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    message = 'Datos inválidos';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Valor inválido para "${err.path}"`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'Ya existe un registro con esos datos (valor duplicado)';
    details = err.keyValue;
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'La sesión expiró, inicie sesión nuevamente';
  } else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Token inválido';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Formato o tamaño de archivo no permitido (máx. 5MB)' : err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'JSON mal formado';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ message, ...(details ? { details } : {}), ...(!env.isProd && status >= 500 ? { stack: err.stack } : {}) });
};
