import { User, ROLES } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertId, pagination } from '../utils/helpers.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function checkChildren(children) {
  if (children === undefined) return;
  if (!Array.isArray(children)) throw new ApiError(400, '"children" debe ser un arreglo de ids');
  children.forEach((c) => assertId(c, 'children'));
  const n = await User.countDocuments({ _id: { $in: children }, role: 'estudiante' });
  if (n !== new Set(children.map(String)).size) throw new ApiError(400, 'Todos los hijos deben ser usuarios con rol estudiante');
}

// GET /api/users?role=&q=&active=&page=&limit=
export const listUsers = asyncHandler(async (req, res) => {
  const { role, q, active } = req.query;
  const filter = {};
  if (role) {
    if (!ROLES.includes(role)) throw new ApiError(400, 'Rol inválido');
    filter.role = role;
  }
  if (active !== undefined) filter.active = active === 'true';
  if (q) filter.$or = [{ name: new RegExp(escapeRegex(String(q)), 'i') }, { email: new RegExp(escapeRegex(String(q)), 'i') }];
  const { page, limit, skip } = pagination(req.query);
  const [items, total] = await Promise.all([
    User.find(filter).populate('children', 'name course').sort({ name: 1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

// GET /api/users/stats  → conteo por rol
export const userStats = asyncHandler(async (_req, res) => {
  const rows = await User.aggregate([{ $group: { _id: '$role', total: { $sum: 1 }, active: { $sum: { $cond: ['$active', 1, 0] } } } }]);
  res.json(Object.fromEntries(rows.map((r) => [r._id, { total: r.total, active: r.active }])));
});

// POST /api/users
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, course, children } = req.body;
  await checkChildren(children);
  const user = await User.create({ name, email, password, role, course, children });
  res.status(201).json({ user });
});

// GET /api/users/:id
export const getUser = asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const user = await User.findById(req.params.id).populate('children', 'name course');
  if (!user) throw new ApiError(404, 'Usuario no encontrado');
  res.json({ user });
});

// PUT /api/users/:id
export const updateUser = asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const user = await User.findById(req.params.id).select('+password');
  if (!user) throw new ApiError(404, 'Usuario no encontrado');
  const { name, email, password, role, course, children, active } = req.body;
  if (req.user._id.equals(user._id) && (active === false || (role && role !== user.role))) {
    throw new ApiError(400, 'No puede desactivarse ni cambiar su propio rol');
  }
  await checkChildren(children);
  Object.entries({ name, email, role, course, children, active }).forEach(([k, v]) => { if (v !== undefined) user[k] = v; });
  if (password) user.password = password; // se re-hashea en el hook pre('save')
  await user.save();
  res.json({ user });
});

// DELETE /api/users/:id  → baja lógica (conserva el historial académico)
export const deactivateUser = asyncHandler(async (req, res) => {
  assertId(req.params.id);
  if (req.user._id.equals(req.params.id)) throw new ApiError(400, 'No puede desactivar su propia cuenta');
  const user = await User.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!user) throw new ApiError(404, 'Usuario no encontrado');
  res.json({ message: 'Usuario desactivado', user });
});
