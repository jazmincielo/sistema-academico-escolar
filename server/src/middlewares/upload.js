import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../utils/ApiError.js';

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  // Nombre aleatorio: evita colisiones y path traversal con el nombre original
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
});

const make = (allowed, label) =>
  multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // máx. 5MB
    fileFilter: (_req, file, cb) =>
      allowed.includes(file.mimetype) ? cb(null, true) : cb(new ApiError(400, `Formato o tamaño de archivo no permitido (${label}, máx. 5MB)`)),
  });

/** Comprobantes de justificación: solo PDF o JPG (UC-08). */
export const uploadProof = make(['application/pdf', 'image/jpeg'], 'solo PDF o JPG');

/** Entrega de tareas: documentos e imágenes comunes. */
export const uploadHomework = make(
  ['application/pdf', 'image/jpeg', 'image/png', 'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  'PDF, JPG, PNG, DOCX, ZIP o TXT'
);

export const toFileInfo = (f) => (f ? { originalName: f.originalname, path: f.filename, mimeType: f.mimetype, size: f.size } : undefined);
export const filePath = (stored) => path.join(UPLOAD_DIR, path.basename(stored)); // basename: seguridad extra
