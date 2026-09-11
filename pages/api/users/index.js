import { prisma } from '../../../lib/prisma';
import { getSessionFromReq, hashPassword } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = getSessionFromReq(req);
  if (!session || session.role !== 'admin') return res.status(403).json({ error: 'Solo el administrador puede ver usuarios.' });

  if (req.method === 'GET') {
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true } });
    return res.status(200).json({ users });
  }

  if (req.method === 'POST') {
    const { email, name, password, role } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !name || !password) return res.status(400).json({ error: 'Faltan datos.' });
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) return res.status(400).json({ error: 'Ya existe un usuario con ese correo.' });
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email: cleanEmail, name, role: role || 'produccion', passwordHash } });
    return res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }

  res.status(405).end();
}
