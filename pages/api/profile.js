import { prisma } from '../../lib/prisma';
import { getSessionFromReq, hashPassword, comparePassword, MIN_PASSWORD } from '../../lib/auth';

// Datos del propio usuario (cualquier rol): mostrar o no el asistente de uso, y cambiar su contraseña.
export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });

  if (req.method === 'PATCH') {
    const { showGuide, currentPassword, newPassword } = req.body || {};

    // Cambio de contraseña: exige la actual, así una sesión abierta ajena no basta para cambiarla.
    if (newPassword !== undefined) {
      if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD) return res.status(400).json({ error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` });
      const me = await prisma.user.findUnique({ where: { id: session.id }, select: { passwordHash: true } });
      if (!currentPassword || !(await comparePassword(String(currentPassword), me.passwordHash))) return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
      await prisma.user.update({ where: { id: session.id }, data: { passwordHash: await hashPassword(newPassword) } });
      return res.status(200).json({ ok: true });
    }

    if (typeof showGuide !== 'boolean') return res.status(400).json({ error: 'Valor inválido.' });
    const user = await prisma.user.update({ where: { id: session.id }, data: { showGuide }, select: { id: true, email: true, name: true, role: true, showGuide: true } });
    return res.status(200).json({ user });
  }

  res.status(405).end();
}
