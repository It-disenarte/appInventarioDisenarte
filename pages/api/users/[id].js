import { prisma } from '../../../lib/prisma';
import { getSessionFromReq, hashPassword, generateTempPassword } from '../../../lib/auth';
import { normalizeRoles } from '../../../lib/permissions';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session || session.role !== 'admin') return res.status(403).json({ error: 'Solo el administrador puede modificar usuarios.' });

  const id = Number(req.query.id);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

  if (req.method === 'PATCH') {
    const { role, resetPassword } = req.body || {};
    // Restablecer: genera una contraseña provisional que la persona debe cambiar al entrar.
    // Sus sesiones abiertas dejan de valer de inmediato (getSessionFromReq rechaza mustChangePassword).
    if (resetPassword) {
      if (session.id === id) return res.status(400).json({ error: 'Cambia tu contraseña desde Mi perfil.' });
      const tempPassword = generateTempPassword();
      await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true } });
      return res.status(200).json({ tempPassword });
    }
    // role: uno o varios (arreglo o "produccion,diseno"). Súper y Admin no se combinan con otros.
    const finalRole = normalizeRoles(role);
    if (!finalRole) return res.status(400).json({ error: 'Rol inválido.' });
    // Evita que el admin se quite el rol y la app se quede sin administrador.
    if (session.id === id && finalRole !== 'admin') return res.status(400).json({ error: 'No puedes quitarte el rol de administrador.' });
    const user = await prisma.user.update({ where: { id }, data: { role: finalRole } });
    return res.status(200).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }

  if (req.method === 'DELETE') {
    if (session.id === id) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
    await prisma.user.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
