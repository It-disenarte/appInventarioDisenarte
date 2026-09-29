import { prisma } from '../../../lib/prisma';
import { getSessionFromReq } from '../../../lib/auth';
import { ROLE_KEYS } from '../../../lib/permissions';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session || session.role !== 'admin') return res.status(403).json({ error: 'Solo el administrador puede modificar usuarios.' });

  const id = Number(req.query.id);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

  if (req.method === 'PATCH') {
    const { role } = req.body || {};
    if (!ROLE_KEYS.includes(role)) return res.status(400).json({ error: 'Rol inválido.' });
    // Evita que el admin se quite el rol y la app se quede sin administrador.
    if (session.id === id && role !== 'admin') return res.status(400).json({ error: 'No puedes quitarte el rol de administrador.' });
    const user = await prisma.user.update({ where: { id }, data: { role } });
    return res.status(200).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }

  if (req.method === 'DELETE') {
    if (session.id === id) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
    await prisma.user.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
