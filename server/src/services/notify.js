import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { sendMail } from './mailer.js';

/**
 * Crea notificaciones internas y, opcionalmente, envía el correo (RF-006).
 * Nunca interrumpe el flujo principal: los errores se registran y se ignoran.
 */
export async function notifyUsers(userIds, { title, message, type = 'sistema', email = true }) {
  try {
    const ids = [...new Set(userIds.map(String))];
    if (!ids.length) return;
    await Notification.insertMany(ids.map((user) => ({ user, title, message, type })));
    if (email) {
      const users = await User.find({ _id: { $in: ids }, active: true }).select('email name');
      await Promise.allSettled(users.map((u) => sendMail({ to: u.email, subject: title, text: `Hola ${u.name},\n\n${message}\n\nSistema Académico Escolar` })));
    }
  } catch (err) {
    console.error('Error enviando notificaciones:', err.message);
  }
}

/** Devuelve los estudiantes indicados más sus apoderados. */
export async function studentsAndGuardians(studentIds) {
  const guardians = await User.find({ role: 'apoderado', children: { $in: studentIds } }).select('_id');
  return [...studentIds, ...guardians.map((g) => g._id)];
}
