import { prisma } from '../../../lib/prisma';
import { getSessionFromReq } from '../../../lib/auth';
import { zohoConfigured, isTaskClosed } from '../../../lib/zoho';

// POST: libera las solicitudes cuya tarea ya se cerró en Zoho (Entregado-Finalizado),
// para que el botón de reabastecer vuelva a aparecer si el artículo sigue bajo mínimo.
export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });
  if (req.method !== 'POST') return res.status(405).end();
  if (!zohoConfigured()) return res.status(200).json({ cleared: [] });

  // Reservas que quedaron a medias (sin tarea) por más de 5 minutos se liberan.
  await prisma.item.updateMany({ where: { zohoTaskId: null, zohoRequestedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } }, data: { zohoRequestedAt: null } });

  const pending = await prisma.item.findMany({ where: { zohoTaskId: { not: null } }, select: { id: true, zohoTaskId: true } });
  const results = await Promise.allSettled(pending.map(async (it) => ((await isTaskClosed(it.zohoTaskId)) ? it.id : null)));
  const cleared = results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
  if (cleared.length) await prisma.item.updateMany({ where: { id: { in: cleared } }, data: { zohoTaskId: null, zohoRequestedAt: null } });
  return res.status(200).json({ cleared });
}
