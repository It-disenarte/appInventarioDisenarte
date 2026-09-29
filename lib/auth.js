import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const SECRET = process.env.JWT_SECRET;

export function signSession(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, SECRET, { expiresIn: '30d' });
}

export function verifySession(token) {
  try { return jwt.verify(token, SECRET); } catch (e) { return null; }
}

export async function hashPassword(pw) { return bcrypt.hash(pw, 10); }
export async function comparePassword(pw, hash) { return bcrypt.compare(pw, hash); }

// El JWT solo identifica al usuario. Nombre y rol se leen siempre de la BD,
// así un cambio de rol o un usuario eliminado surten efecto de inmediato.
export async function getSessionFromReq(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  const payload = verifySession(decodeURIComponent(match[1]));
  if (!payload || !payload.id) return null;
  return prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, email: true, name: true, role: true, showGuide: true } });
}
