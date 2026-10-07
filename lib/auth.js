import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './prisma';

const SECRET = process.env.JWT_SECRET;

export function signSession(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, SECRET, { expiresIn: '30d' });
}

export function verifySession(token) {
  try { return jwt.verify(token, SECRET); } catch (e) { return null; }
}

export const MIN_PASSWORD = 8;

export async function hashPassword(pw) { return bcrypt.hash(pw, 10); }
export async function comparePassword(pw, hash) { return bcrypt.compare(pw, hash); }

// Contraseña provisional que genera el admin: 10 caracteres sin los que se confunden (0/O, 1/l/I).
const TEMP_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
export function generateTempPassword() {
  return Array.from({ length: 10 }, () => TEMP_CHARS[crypto.randomInt(TEMP_CHARS.length)]).join('');
}

// El JWT solo identifica al usuario. Nombre y rol se leen siempre de la BD,
// así un cambio de rol o un usuario eliminado surten efecto de inmediato.
// Con contraseña provisional pendiente no hay sesión válida, salvo para cambiarla (`allowPending`).
export async function getSessionFromReq(req, { allowPending = false } = {}) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  const payload = verifySession(decodeURIComponent(match[1]));
  if (!payload || !payload.id) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, email: true, name: true, role: true, showGuide: true, mustChangePassword: true } });
  if (!user || (user.mustChangePassword && !allowPending)) return null;
  return user;
}
