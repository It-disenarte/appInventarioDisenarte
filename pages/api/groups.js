import { prisma } from '../../lib/prisma';
import { getSessionFromReq } from '../../lib/auth';

export default async function handler(req, res) {
  const session = getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });
  if (req.method !== 'GET') return res.status(405).end();
  const groups = await prisma.group.findMany({ orderBy: { order: 'asc' }, include: { categories: true } });
  res.status(200).json({ groups });
}
