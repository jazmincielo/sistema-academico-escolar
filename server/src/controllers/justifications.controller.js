import { Justification, REASONS } from '../models/Justification.js';
import { Attendance } from '../models/Attendance.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertId } from '../utils/helpers.js';
import { filePath, toFileInfo } from '../middlewares/upload.js';
import { notifyUsers } from '../services/notify.js';

// POST /api/justifications  (RF-010 / UC-08) multipart: attendance, reason, detail, file (PDF/JPG ≤ 5MB)
export const createJustification = asyncHandler(async (req, res) => {
  const { attendance: attendanceId, reason, detail } = req.body;
  assertId(attendanceId, 'attendance');
  if (!REASONS.includes(reason)) throw new ApiError(400, `Motivo inválido. Use: ${REASONS.join(', ')}`);
  if (!req.file) throw new ApiError(400, 'Formato o tamaño de archivo no permitido: adjunte un comprobante PDF o JPG (máx. 5MB)');

  const att = await Attendance.findById(attendanceId).populate('subject', 'name');
  if (!att) throw new ApiError(404, 'Inasistencia no encontrada');
  if (!req.user.children.some((c) => c.equals(att.student))) throw new ApiError(403, 'La inasistencia no corresponde a un estudiante a su cargo');
  if (att.status !== 'ausente') throw new ApiError(409, 'Solo se pueden justificar inasistencias registradas como ausente');

  const existing = await Justification.findOne({ attendance: att._id, status: { $in: ['Pendiente', 'Aprobada'] } });
  if (existing) throw new ApiError(409, `Esta falta ya tiene una solicitud ${existing.status.toLowerCase()} (${existing.ticket})`); // flujo A2

  const justification = await Justification.create({
    attendance: att._id, student: att.student, guardian: req.user._id, reason, detail, file: toFileInfo(req.file),
    ticket: `JUS-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`,
  });

  const admins = await User.find({ role: 'administrador', active: true }).select('_id');
  notifyUsers(admins.map((a) => a._id), {
    title: 'Nueva solicitud de justificación',
    message: `Ticket ${justification.ticket}: falta en ${att.subject.name}. Pendiente de revisión.`,
    type: 'justificacion',
  });
  res.status(201).json({ justification });
});

// GET /api/justifications?status=
export const listJustifications = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === 'apoderado') filter.guardian = req.user._id;
  if (req.query.status) filter.status = req.query.status;
  const items = await Justification.find(filter)
    .populate('student', 'name course').populate('guardian', 'name')
    .populate({ path: 'attendance', select: 'date subject', populate: { path: 'subject', select: 'name' } })
    .sort({ createdAt: -1 });
  res.json({ items });
});

// PATCH /api/justifications/:id/review  (Regencia / administrador)
export const reviewJustification = asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const { status, note } = req.body;
  if (!['Aprobada', 'Rechazada'].includes(status)) throw new ApiError(400, 'status debe ser Aprobada o Rechazada');
  const j = await Justification.findById(req.params.id);
  if (!j) throw new ApiError(404, 'Solicitud no encontrada');
  if (j.status !== 'Pendiente') throw new ApiError(409, `La solicitud ya fue ${j.status.toLowerCase()}`);

  j.status = status; j.reviewNote = note; j.reviewedBy = req.user._id;
  await j.save();
  if (status === 'Aprobada') await Attendance.findByIdAndUpdate(j.attendance, { status: 'justificada' });

  notifyUsers([j.guardian], {
    title: `Justificación ${status.toLowerCase()}`,
    message: `Su solicitud ${j.ticket} fue ${status.toLowerCase()}.${note ? ` Nota: ${note}` : ''}`,
    type: 'justificacion',
  });
  res.json({ justification: j });
});

// GET /api/justifications/:id/file
export const downloadProof = asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const j = await Justification.findById(req.params.id);
  if (!j?.file?.path) throw new ApiError(404, 'Comprobante no encontrado');
  if (req.user.role === 'apoderado' && !j.guardian.equals(req.user._id)) throw new ApiError(403, 'Acceso denegado');
  res.download(filePath(j.file.path), j.file.originalName);
});
