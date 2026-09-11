import { prisma } from '../../../lib/prisma';
import { getSessionFromReq } from '../../../lib/auth';
import { canModify } from '../../../lib/permissions';

export default async function handler(req, res) {
  const session = getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });

  const id = Number(req.query.id);
  const item = await prisma.item.findUnique({ where: { id }, include: { category: { include: { group: true } } } });
  if (!item) return res.status(404).json({ error: 'Artículo no encontrado.' });
  if (!canModify(session.role, item.category.group.area)) return res.status(403).json({ error: 'No tienes permiso sobre esta área.' });

  if (req.method === 'PATCH') {
    const d = Number((req.body || {}).delta) || 0;
    const antes = item.qty;
    const despues = Math.max(0, antes + d);
    const updated = await prisma.item.update({ where: { id }, data: { qty: despues } });
    await prisma.movement.create({ data: { itemId: id, tipo: d > 0 ? 'Entrada' : 'Consumo', delta: d, antes, despues, usuario: session.name } });
    return res.status(200).json({ item: updated });
  }

  if (req.method === 'DELETE') {
    await prisma.movement.deleteMany({ where: { itemId: id } });
    await prisma.item.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
