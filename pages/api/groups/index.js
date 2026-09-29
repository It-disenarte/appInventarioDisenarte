import { prisma } from '../../../lib/prisma';
import { getSessionFromReq } from '../../../lib/auth';
import { canManageGroups, AREA_KEYS } from '../../../lib/permissions';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });

  if (req.method === 'GET') {
    const groups = await prisma.group.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }], include: { categories: { orderBy: { id: 'asc' } } } });
    return res.status(200).json({ groups });
  }

  if (req.method === 'POST') {
    if (!canManageGroups(session.role)) return res.status(403).json({ error: 'No tienes permiso para crear inventarios.' });
    const { label, area, color } = req.body || {};
    if (!label || !String(label).trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    if (!AREA_KEYS.includes(area)) return res.status(400).json({ error: 'Área inválida.' });
    const last = await prisma.group.aggregate({ _max: { order: true } });
    const group = await prisma.group.create({ data: { label: String(label).trim(), area, color: /^#[0-9A-Fa-f]{6}$/.test(color || '') ? color : '#A53692', order: (last._max.order ?? -1) + 1 } });
    return res.status(201).json({ group });
  }

  res.status(405).end();
}
