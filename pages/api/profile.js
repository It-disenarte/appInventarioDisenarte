import { prisma } from '../../lib/prisma';
import { getSessionFromReq, hashPassword, comparePassword, MIN_PASSWORD } from '../../lib/auth';

// Datos del propio usuario: mostrar o no el asistente de uso (cualquier rol) y cambiar la contraseña.
// La contraseña solo la cambia el admin, o quien entró con una provisional (obligado antes de usar la app).
export default async function handler(req, res) {
  const session = await getSessionFromReq(req, { allowPending: true });
  if (!session) return res.status(401).json({ error: 'No autenticado.' });

  if (req.method === 'PATCH') {
    const { showGuide, currentPassword, newPassword } = req.body || {};

    if (newPassword !== undefined) {
      if (session.role !== 'admin' && !session.mustChangePassword) return res.status(403).json({ error: 'Solo el administrador puede cambiar contraseñas.' });
      if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD) return res.status(400).json({ error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` });
      // Exige la actual, así una sesión abierta ajena no basta para cambiarla.
      const me = await prisma.user.findUnique({ where: { id: session.id }, select: { passwordHash: true } });
      if (!currentPassword || !(await comparePassword(String(currentPassword), me.passwordHash))) return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
      if (newPassword === currentPassword) return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual.' });
      await prisma.user.update({ where: { id: session.id }, data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false } });
      return res.status(200).json({ ok: true });
    }

    if (session.mustChangePassword) return res.status(401).json({ error: 'Primero crea tu contraseña.' });
    if (typeof showGuide !== 'boolean') return res.status(400).json({ error: 'Valor inválido.' });
    const user = await prisma.user.update({ where: { id: session.id }, data: { showGuide }, select: { id: true, email: true, name: true, role: true, showGuide: true } });
    return res.status(200).json({ user });
  }

  res.status(405).end();
}
