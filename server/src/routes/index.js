import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middlewares/auth.js';
import { uploadHomework, uploadProof } from '../middlewares/upload.js';
import { env } from '../config/env.js';
import * as auth from '../controllers/auth.controller.js';
import * as users from '../controllers/users.controller.js';
import * as subjects from '../controllers/subjects.controller.js';
import * as grades from '../controllers/grades.controller.js';
import * as attendance from '../controllers/attendance.controller.js';
import * as tasks from '../controllers/tasks.controller.js';
import * as just from '../controllers/justifications.controller.js';
import * as notif from '../controllers/notifications.controller.js';
import { dashboard } from '../controllers/dashboard.controller.js';
import { bulletinPdf } from '../controllers/reports.controller.js';

const ADMIN = 'administrador', DOC = 'docente', EST = 'estudiante', APO = 'apoderado';
const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ---- Autenticación (públicas, con límite de intentos) ----
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isTest ? 1000 : 30, standardHeaders: true, legacyHeaders: false, message: { message: 'Demasiados intentos, intente más tarde' } });
router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login', authLimiter, auth.login);
router.post('/auth/otp/request', authLimiter, auth.requestOtp);
router.post('/auth/otp/verify', authLimiter, auth.verifyOtp);
router.get('/auth/me', authenticate, auth.me);

// ---- Todo lo siguiente exige JWT ----
router.use(authenticate);

router.get('/dashboard', dashboard);

router.get('/users/stats', authorize(ADMIN), users.userStats);
router.route('/users').get(authorize(ADMIN), users.listUsers).post(authorize(ADMIN), users.createUser);
router.route('/users/:id').get(authorize(ADMIN), users.getUser).put(authorize(ADMIN), users.updateUser).delete(authorize(ADMIN), users.deactivateUser);

router.route('/subjects').get(subjects.listSubjects).post(authorize(ADMIN), subjects.createSubject);
router.route('/subjects/:id').get(subjects.getSubject).put(authorize(ADMIN), subjects.updateSubject).delete(authorize(ADMIN), subjects.deleteSubject);

router.get('/grades', grades.listGrades);
router.get('/grades/sheet', authorize(DOC, ADMIN), grades.gradeSheet);
router.put('/grades/bulk', authorize(DOC, ADMIN), grades.saveGrades);
router.get('/grades/bulletin/:studentId', grades.bulletin);
router.delete('/grades/:id', authorize(DOC, ADMIN), grades.deleteGrade);
router.get('/reports/bulletin/:studentId', bulletinPdf);

router.get('/attendance', attendance.listAttendance);
router.get('/attendance/sheet', authorize(DOC, ADMIN), attendance.attendanceSheet);
router.post('/attendance/bulk', authorize(DOC, ADMIN), attendance.saveAttendance);
router.get('/attendance/summary/:studentId', attendance.attendanceSummary);

router.route('/tasks').get(tasks.listTasks).post(authorize(DOC, ADMIN), tasks.createTask);
router.get('/tasks/submissions/:submissionId/file', authorize(DOC, ADMIN, EST), tasks.downloadSubmissionFile);
router.route('/tasks/:id').put(authorize(DOC, ADMIN), tasks.updateTask).delete(authorize(DOC, ADMIN), tasks.deleteTask);
router.route('/tasks/:id/submissions')
  .get(authorize(DOC, ADMIN), tasks.listSubmissions)
  .post(authorize(EST), uploadHomework.single('file'), tasks.submitTask);

router.route('/justifications')
  .get(authorize(APO, ADMIN), just.listJustifications)
  .post(authorize(APO), uploadProof.single('file'), just.createJustification);
router.patch('/justifications/:id/review', authorize(ADMIN), just.reviewJustification);
router.get('/justifications/:id/file', authorize(APO, ADMIN), just.downloadProof);

router.get('/notifications', notif.listNotifications);
router.patch('/notifications/read-all', notif.markAllRead);
router.patch('/notifications/:id/read', notif.markRead);

export default router;
