import { prisma } from '../../../lib/prisma';
import { comparePassword, signSession } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password } = req.body || {};
  const user = await prisma.user.findUnique({ where: { email: (email || '').trim().toLowerCase() } });
  if (!user) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  const ok = await comparePassword(password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  const token = signSession(user);
  res.setHeader('Set-Cookie', 'session=' + token + '; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax; Secure');
  res.status(200).json({ user: { email: user.email, name: user.name, role: user.role } });
}
