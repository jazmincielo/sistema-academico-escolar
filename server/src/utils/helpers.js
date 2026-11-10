import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';

export function assertId(id, label = 'id') {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `El campo "${label}" no es un identificador válido`);
  return id;
}

/** Convierte 'YYYY-MM-DD' en una fecha UTC a medianoche (un registro por día). */
export function parseDay(str, label = 'date') {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    throw new ApiError(400, `"${label}" debe tener formato YYYY-MM-DD`);
  }
  const d = new Date(`${str}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, `"${label}" no es una fecha válida`);
  return d;
}

export function pagination(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export const round1 = (n) => Math.round(n * 10) / 10;
export const avg = (arr) => (arr.length ? round1(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
