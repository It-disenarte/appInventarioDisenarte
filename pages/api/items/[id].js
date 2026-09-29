import { prisma } from '../../../lib/prisma';
import { getSessionFromReq } from '../../../lib/auth';
import { canModify } from '../../../lib/permissions';
import { cleanCharacteristics } from '../../../lib/characteristics';
import { cleanItemFields } from '../../../lib/itemFields';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });

  const id = Number(req.query.id);
  const item = await prisma.item.findUnique({ where: { id }, include: { category: { include: { group: true } } } });
  if (!item) return res.status(404).json({ error: 'Artículo no encontrado.' });
  if (!canModify(session.role, item.category.group.area)) return res.status(403).json({ error: 'No tienes permiso sobre esta área.' });

  if (req.method === 'PATCH') {
    const body = req.body || {};

    // Sin delta: edición de datos del artículo (no toca la cantidad).
    if (body.delta === undefined) {
      let data;
      try { data = cleanItemFields(body); } catch (e) { return res.status(400).json({ error: e.message }); }
      if (body.name !== undefined) {
        if (!String(body.name).trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
        data.name = String(body.name).trim();
      }
      if (body.reorder !== undefined) data.reorder = Math.max(0, Math.trunc(Number(body.reorder) || 0));
      if (body.characteristics !== undefined) data.characteristics = cleanCharacteristics(item.category.schema, body.characteristics);
      const updated = await prisma.item.update({ where: { id }, data });
      return res.status(200).json({ item: updated });
    }

    const d = Math.trunc(Number(body.delta) || 0);
    if (d === 0) return res.status(400).json({ error: 'Cantidad inválida.' });

    // El increment es atómico y bloquea la fila hasta el fin de la transacción,
    // así dos ajustes simultáneos no se pisan.
    const result = await prisma.$transaction(async (tx) => {
      let updated = await tx.item.update({ where: { id }, data: { qty: { increment: d } } });
      const antes = updated.qty - d;
      if (updated.qty < 0) updated = await tx.item.update({ where: { id }, data: { qty: 0 } });
      // Repuesto por encima del mínimo: la solicitud de Zoho ya cumplió, se libera el botón.
      if (updated.qty > updated.reorder && (updated.zohoTaskId || updated.zohoRequestedAt)) {
        updated = await tx.item.update({ where: { id }, data: { zohoTaskId: null, zohoRequestedAt: null } });
      }
      const despues = updated.qty;
      const real = despues - antes;
      if (real === 0) return { item: updated, movement: null };
      const movement = await tx.movement.create({ data: { itemId: id, tipo: real > 0 ? 'Entrada' : 'Consumo', delta: real, antes, despues, usuario: session.name }, include: { item: { include: { category: { include: { group: true } } } } } });
      return { item: updated, movement };
    });
    return res.status(200).json(result);
  }

  if (req.method === 'DELETE') {
    await prisma.movement.deleteMany({ where: { itemId: id } });
    await prisma.item.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
