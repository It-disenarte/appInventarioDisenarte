import { prisma } from '../../../lib/prisma';
import { getSessionFromReq } from '../../../lib/auth';
import { canModify } from '../../../lib/permissions';
import { cleanSchema } from '../../../lib/characteristics';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });

  if (req.method === 'POST') {
    const { groupId, name, unit, schema } = req.body || {};
    const group = await prisma.group.findUnique({ where: { id: Number(groupId) } });
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado.' });
    if (!canModify(session.role, group.area)) return res.status(403).json({ error: 'No tienes permiso sobre esta área.' });
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    const category = await prisma.category.create({ data: { name: String(name).trim(), unit: unit || 'piezas', groupId: group.id, schema: cleanSchema(schema) } });
    return res.status(201).json({ category });
  }

  res.status(405).end();
}
