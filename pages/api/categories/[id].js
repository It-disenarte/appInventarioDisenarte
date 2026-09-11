import { prisma } from '../../../lib/prisma';
import { getSessionFromReq } from '../../../lib/auth';
import { canModify } from '../../../lib/permissions';

export default async function handler(req, res) {
  const session = getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });

  const id = Number(req.query.id);
  const category = await prisma.category.findUnique({ where: { id }, include: { group: true, items: true } });
  if (!category) return res.status(404).json({ error: 'Categoría no encontrada.' });
  if (!canModify(session.role, category.group.area)) return res.status(403).json({ error: 'No tienes permiso sobre esta área.' });

  if (req.method === 'PATCH') {
    const { name, unit, schema } = req.body || {};
    const data = {};
    if (name !== undefined) data.name = name;
    if (unit !== undefined) data.unit = unit;
    if (schema !== undefined) data.schema = schema;
    const updated = await prisma.category.update({ where: { id }, data });
    return res.status(200).json({ category: updated });
  }

  if (req.method === 'DELETE') {
    if (category.items.length > 0) return res.status(400).json({ error: 'No puedes eliminar una categoría con artículos.' });
    await prisma.category.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
