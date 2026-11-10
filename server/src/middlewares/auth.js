import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyToken } from '../utils/token.js';

/** Verifica el JWT enviado en el encabezado `Authorization: Bearer <token>` y carga req.user. */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Token de autenticación requerido');

  const payload = verifyToken(token); // lanza JsonWebTokenError / TokenExpiredError (→ 401)
  const user = await User.findById(payload.sub);
  if (!user || !user.active) throw new ApiError(401, 'Usuario inexistente o desactivado');

  req.user = user;
  next();
});

/** RBAC: permite el acceso solo a los roles indicados. */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new ApiError(401, 'No autenticado'));
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, `Acceso denegado: se requiere rol ${roles.join(' o ')}`));
  }
  next();
};
