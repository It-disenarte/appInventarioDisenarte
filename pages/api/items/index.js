import { prisma } from '../../../lib/prisma';
import { getSessionFromReq } from '../../../lib/auth';
import { canModify } from '../../../lib/permissions';

export default async function handler(req, res) {
  const session = getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });

  if (req.method === 'GET') {
    const items = await prisma.item.findMany({ include: { category: { include: { group: true } } }, orderBy: { name: 'asc' } });
    return res.status(200).json({ items });
  }

  if (req.method === 'POST') {
    const { categoryId, name, qty, reorder } = req.body || {};
    const category = await prisma.category.findUnique({ where: { id: Number(categoryId) }, include: { group: true } });
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada.' });
    if (!canModify(session.role, category.group.area)) return res.status(403).json({ error: 'No tienes permiso sobre esta área.' });
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    const initialQty = Number(qty) || 0;
    const item = await prisma.item.create({ data: { name: String(name).trim(), qty: initialQty, reorder: Number(reorder) || 0, categoryId: category.id, characteristics: {} } });
    if (initialQty > 0) {
      await prisma.movement.create({ data: { itemId: item.id, tipo: 'Entrada', delta: initialQty, antes: 0, despues: initialQty, usuario: session.name } });
    }
    return res.status(201).json({ item });
  }

  res.status(405).end();
}
