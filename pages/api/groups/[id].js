import { prisma } from '../../../lib/prisma';
import { getSessionFromReq } from '../../../lib/auth';
import { canManageGroups, AREA_KEYS } from '../../../lib/permissions';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });
  if (!canManageGroups(session.role)) return res.status(403).json({ error: 'No tienes permiso para modificar inventarios.' });

  const id = Number(req.query.id);
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) return res.status(404).json({ error: 'Inventario no encontrado.' });

  if (req.method === 'PATCH') {
    const { label, area, color } = req.body || {};
    const data = {};
    if (label !== undefined) { if (!String(label).trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' }); data.label = String(label).trim(); }
    if (area !== undefined) { if (!AREA_KEYS.includes(area)) return res.status(400).json({ error: 'Área inválida.' }); data.area = area; }
    if (color !== undefined) { if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return res.status(400).json({ error: 'Color inválido.' }); data.color = color; }
    const updated = await prisma.group.update({ where: { id }, data });
    return res.status(200).json({ group: updated });
  }

  if (req.method === 'DELETE') {
    await prisma.$transaction([
      prisma.movement.deleteMany({ where: { item: { category: { groupId: id } } } }),
      prisma.item.deleteMany({ where: { category: { groupId: id } } }),
      prisma.category.deleteMany({ where: { groupId: id } }),
      prisma.group.delete({ where: { id } }),
    ]);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
