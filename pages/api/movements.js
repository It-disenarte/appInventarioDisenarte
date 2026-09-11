import { prisma } from '../../lib/prisma';
import { getSessionFromReq } from '../../lib/auth';

export default async function handler(req, res) {
  const session = getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });
  if (session.role !== 'admin' && session.role !== 'super') return res.status(403).json({ error: 'No tienes permiso para ver movimientos.' });

  if (req.method === 'GET') {
    const movements = await prisma.movement.findMany({ include: { item: { include: { category: { include: { group: true } } } } }, orderBy: { fecha: 'desc' } });
    return res.status(200).json({ movements });
  }

  if (req.method === 'DELETE') {
    if (req.query.id) {
      await prisma.movement.delete({ where: { id: Number(req.query.id) } });
    } else {
      await prisma.movement.deleteMany({});
    }
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
