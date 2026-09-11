import { prisma } from '../../../lib/prisma';
import { getSessionFromReq } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = getSessionFromReq(req);
  if (!session || session.role !== 'admin') return res.status(403).json({ error: 'Solo el administrador puede modificar usuarios.' });

  const id = Number(req.query.id);

  if (req.method === 'PATCH') {
    const { role } = req.body || {};
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
