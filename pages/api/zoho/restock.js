import { prisma } from '../../../lib/prisma';
import { getSessionFromReq } from '../../../lib/auth';
import { zohoConfigured, createRestockTask, taskWebUrl } from '../../../lib/zoho';

// POST { itemId }: crea la solicitud de reabastecimiento en Zoho Projects (DI-5 · Solicitud).
// Cualquier usuario puede solicitar; no modifica el inventario.
export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });
  if (req.method !== 'POST') return res.status(405).end();
  if (!zohoConfigured()) return res.status(503).json({ error: 'La integración con Zoho Projects aún no está configurada.' });

  const id = Number((req.body || {}).itemId);
  const item = await prisma.item.findUnique({ where: { id }, include: { category: { include: { group: true } } } });
  if (!item) return res.status(404).json({ error: 'Artículo no encontrado.' });
  if (item.qty > item.reorder) return res.status(400).json({ error: 'El artículo aún no está bajo su punto de reorden.' });
  if (item.zohoTaskId) return res.status(409).json({ error: 'Este artículo ya tiene una solicitud abierta.', url: taskWebUrl(item.zohoTaskId) });

  // Reserva la solicitud antes de llamar a Zoho: si dos personas pulsan a la vez, solo una crea la tarea.
  const claimed = await prisma.item.updateMany({ where: { id, zohoTaskId: null, zohoRequestedAt: null }, data: { zohoRequestedAt: new Date() } });
  if (claimed.count === 0) return res.status(409).json({ error: 'Alguien más acaba de solicitar este artículo.' });

  try {
    const task = await createRestockTask({ item, category: item.category, group: item.category.group, requestedBy: session });
    const updated = await prisma.item.update({ where: { id }, data: { zohoTaskId: task.id } });
    return res.status(201).json({ item: { id: updated.id, zohoTaskId: updated.zohoTaskId, zohoRequestedAt: updated.zohoRequestedAt }, task });
  } catch (e) {
    await prisma.item.update({ where: { id }, data: { zohoRequestedAt: null } });
    console.error('Zoho restock', e);
    return res.status(502).json({ error: e.message || 'No se pudo crear la solicitud en Zoho Projects.' });
  }
}
