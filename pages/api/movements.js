import { prisma } from '../../lib/prisma';
import { getSessionFromReq } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });
  if (session.role !== 'admin' && session.role !== 'super') return res.status(403).json({ error: 'No tienes permiso para ver movimientos.' });

  if (req.method === 'GET') {
    const movements = await prisma.movement.findMany({ include: { item: { include: { category: { include: { group: true } } } } }, orderBy: { fecha: 'desc' } });
    return res.status(200).json({ movements });
  }

  if (req.method === 'DELETE') {
    // ?id= borra uno; ?groupId= vacía solo ese inventario. Sin ninguno se rechaza,
    // para que nunca se borre el historial de todos los grupos por accidente.
    if (req.query.id) {
      await prisma.movement.delete({ where: { id: Number(req.query.id) } });
    } else if (req.query.groupId) {
      await prisma.movement.deleteMany({ where: { item: { category: { groupId: Number(req.query.groupId) } } } });
    } else {
      return res.status(400).json({ error: 'Indica el movimiento o el inventario a vaciar.' });
    }
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
