import PDFDocument from 'pdfkit';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertCanViewStudent } from '../services/access.js';
import { getAttendanceSummary, getBulletin } from '../services/academic.js';

// GET /api/reports/bulletin/:studentId  (RF-009) → PDF
export const bulletinPdf = asyncHandler(async (req, res) => {
  await assertCanViewStudent(req.user, req.params.studentId);
  const student = await User.findById(req.params.studentId).select('name course');
  if (!student) throw new ApiError(404, 'Estudiante no encontrado');
  const [{ rows, generalAverage }, att] = await Promise.all([getBulletin(student._id), getAttendanceSummary(student._id)]);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="boletin-${student._id}.pdf"`);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  doc.fillColor('#084298').fontSize(20).text('Boletín de Calificaciones', { align: 'center' });
  doc.moveDown(0.3).fillColor('#444').fontSize(11).text('Sistema Académico Escolar', { align: 'center' });
  doc.moveDown().fillColor('#000').fontSize(12)
    .text(`Estudiante: ${student.name}`).text(`Curso: ${student.course || '—'}`)
    .text(`Emitido: ${new Date().toLocaleDateString('es-BO')}`).moveDown();

  const cols = [50, 230, 290, 340, 390, 450];
  const header = ['Materia', 'T1', 'T2', 'T3', 'Promedio'];
  let y = doc.y;
  doc.rect(50, y - 4, 495, 20).fill('#084298');
  doc.fillColor('#fff').fontSize(10);
  header.forEach((h, i) => doc.text(h, cols[i] + (i ? 0 : 4), y, { width: 120 }));
  y += 24;
  doc.fillColor('#000');
  rows.forEach((r, idx) => {
    if (idx % 2 === 0) doc.rect(50, y - 4, 495, 20).fill('#eef3fb').fillColor('#000');
    const cells = [r.subject.name, r.T1, r.T2, r.T3, r.average];
    cells.forEach((c, i) => doc.fontSize(10).text(c ?? '—', cols[i] + (i ? 0 : 4), y, { width: i ? 50 : 170 }));
    y += 22;
  });
  doc.moveDown(2).fontSize(12).fillColor('#084298')
    .text(`Promedio general: ${generalAverage ?? '—'} / 100`, 50, y + 10)
    .text(`Asistencia: ${att.percentage ?? '—'}%  (${att.ausente} falta(s) sin justificar)`);
  doc.end();
});
