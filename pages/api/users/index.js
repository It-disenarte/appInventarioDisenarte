import { prisma } from '../../../lib/prisma';
import { getSessionFromReq, hashPassword, MIN_PASSWORD } from '../../../lib/auth';
import { normalizeRoles } from '../../../lib/permissions';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session || session.role !== 'admin') return res.status(403).json({ error: 'Solo el administrador puede ver usuarios.' });

  if (req.method === 'GET') {
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, mustChangePassword: true }, orderBy: { id: 'asc' } });
    return res.status(200).json({ users });
  }

  if (req.method === 'POST') {
    const { email, name, password, role } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !name || !String(name).trim() || !password) return res.status(400).json({ error: 'Faltan datos.' });
    if (String(password).length < MIN_PASSWORD) return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` });
    const finalRole = normalizeRoles(role || 'produccion');
    if (!finalRole) return res.status(400).json({ error: 'Rol inválido.' });
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) return res.status(400).json({ error: 'Ya existe un usuario con ese correo.' });
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email: cleanEmail, name: String(name).trim(), role: finalRole, passwordHash } });
    return res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }

  res.status(405).end();
}
